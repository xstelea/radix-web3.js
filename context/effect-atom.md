# effect-atom Library Context

> Reactive state management for Effect.js + React

**Source:** `.repos/effect-atom` (vendored monorepo)
**Packages:** `@effect-atom/atom`, `@effect-atom/atom-react`

---

## Core Mental Model

**Atoms are reactive Effect containers.** Think of them as:

- Reactive `Ref`s that notify subscribers on change
- Lazy computed values with automatic dependency tracking
- Safe wrappers around async/effectful computations
- Nodes in a reactive dependency graph

```
Component subscribes → Atom computes → Dependencies tracked → Re-render on change
```

---

## Key Concepts

### Result<A, E> — Not Promises

Effect atoms don't return raw values. They return `Result`:

```typescript
type Result<A, E> = Initial | Success<A> | Failure<E>

// Pattern matching
Result.builder(result)
  .onInitial(() => <Loading />)
  .onSuccess((data) => <Content data={data} />)
  .onFailure((error) => <Error error={error} />)
  .render()

// Direct access (throws on Initial/Failure)
Result.getOrThrow(result)
```

### Atom Types

| Type                 | Description              | Example                              |
| -------------------- | ------------------------ | ------------------------------------ |
| `Atom<A>`            | Read-only reactive value | `Atom.make((get) => get(other) * 2)` |
| `Writable<R, W>`     | Read + write             | `Atom.make(0)` (primitive)           |
| `Atom<Result<A, E>>` | Effect-backed async      | `runtime.atom(Effect.gen(...))`      |

### Reference Identity Matters

```typescript
const atom1 = Atom.make(0);
const atom2 = Atom.make(0);
// atom1 !== atom2 — different atoms!

// Use Atom.family for stable references
const userAtom = Atom.family((id: string) => Atom.make(fetchUser(id)));
userAtom("123") === userAtom("123"); // true — same reference
```

---

## Project Patterns

### Runtime Setup (`makeRuntimeAtom.ts`)

```typescript
// Create shared atom context with global layers
export const makeAtomRuntime = Atom.context({
  memoMap: Atom.defaultMemoMap,
});

// Add global services (logging, config)
makeAtomRuntime.addGlobalLayer(
  Layer.provideMerge(Logger.pretty, Logger.minimumLogLevel(LogLevel.Debug))
);
```

### Creating Service-Backed Atoms

```typescript
// 1. Build a runtime with required services
const runtime = makeAtomRuntime(
  Layer.mergeAll(GovernanceComponent.Default, SendTransaction.Default).pipe(
    Layer.provideMerge(RadixDappToolkit.Live),
    Layer.provide(Config.StokenetLive)
  )
);

// 2. Create atoms that use those services
export const temperatureChecksAtom = runtime.atom(
  Effect.gen(function* () {
    const governance = yield* GovernanceComponent;
    return yield* governance.getTemperatureChecks();
  })
);
```

### Function Atoms with `runtime.fn`

For atoms that execute effects with arguments:

```typescript
export const voteAtom = runtime.fn(
  Effect.fn(
    function* (input: VoteInput) {
      const governance = yield* GovernanceComponent;
      return yield* governance.vote(input);
    },
    withToast({
      whenLoading: "Submitting vote...",
      whenSuccess: "Vote submitted",
      whenFailure: ({ cause }) => Option.some("Failed"),
    })
  )
);

// Usage in component
const vote = useAtomSet(voteAtom);
vote({ temperatureCheckId, vote: "For" });
```

### Parameterized Atoms with `Atom.family`

```typescript
export const getTemperatureCheckByIdAtom = Atom.family(
  (id: TemperatureCheckId) =>
    runtime.atom(
      Effect.gen(function* () {
        const governance = yield* GovernanceComponent;
        return yield* governance.getTemperatureCheckById(id);
      })
    )
);

// Usage — same ID returns same atom instance
const tc = useAtomValue(getTemperatureCheckByIdAtom(id));
```

### Derived Atoms with Dependencies

```typescript
export const votesForConnectedAccountsAtom = Atom.family(
  (kvsAddress: KeyValueStoreAddress) =>
    runtime.atom(
      Effect.fnUntraced(function* (get) {
        // Subscribe to accountsAtom — reruns when accounts change
        const accounts = yield* get.result(accountsAtom);

        const governance = yield* GovernanceComponent;
        return yield* governance.getVotes({ kvsAddress, accounts });
      })
    )
);
```

---

## React Hooks

### Reading Values

```typescript
// Basic read
const checks = useAtomValue(temperatureChecksAtom);

// With selector/transform
const count = useAtomValue(temperatureChecksAtom, (result) =>
  Result.map(result, (checks) => checks.length)
);

// Unwrap Result (throws on Initial/Failure)
const data = useAtomValue(atom, Result.getOrThrow);
```

### Writing Values

```typescript
// Get setter function
const setCount = useAtomSet(countAtom);
setCount(10); // direct value
setCount((c) => c + 1); // updater function

// For function atoms (runtime.fn)
const vote = useAtomSet(voteAtom);
vote({ temperatureCheckId, vote: "For" });
```

### Combined Read/Write

```typescript
const [value, setValue] = useAtom(countAtom);
```

### Suspense Support

```typescript
<Suspense fallback={<Loading />}>
  <DataComponent />
</Suspense>

function DataComponent() {
  // Throws promise while Initial — triggers Suspense
  const data = useAtomSuspense(asyncAtom)
  return <div>{data}</div>
}
```

### Force Refresh

```typescript
const refresh = useAtomRefresh(temperatureChecksAtom);
// Call after mutations to refetch
refresh();
```

---

## Toast Integration (`withToast`)

Higher-order function that wraps Effect atoms with toast notifications:

```typescript
export const myAtom = runtime.fn(
  Effect.fn(
    function* (input: Input) {
      /* ... */
    },
    withToast({
      whenLoading: "Processing...",
      whenSuccess: "Done!",
      // or dynamic: ({ result }) => `Created ${result.id}`
      whenFailure: ({ cause }) => {
        if (cause._tag === "Fail") {
          if (cause.error instanceof MyCustomError) {
            return Option.some(cause.error.message);
          }
        }
        return Option.some("Something went wrong");
      },
    })
  )
);
```

---

## Tagged Errors Pattern

Use `Data.TaggedError` for typed error handling:

```typescript
export class AccountAlreadyVotedError extends Data.TaggedError(
  "AccountAlreadyVotedError"
)<{ message: string }> {}

// In atom
if (alreadyVoted) {
  return (
    yield *
    new AccountAlreadyVotedError({
      message: "Already voted",
    })
  );
}

// In toast handler
whenFailure: ({ cause }) => {
  if (cause._tag === "Fail") {
    if (cause.error instanceof AccountAlreadyVotedError) {
      return Option.some(cause.error.message);
    }
  }
  return Option.some("Failed");
};
```

---

## Memory Management

### Keep Alive

Atoms are garbage-collected when no subscribers. Use `keepAlive` for persistent state:

```typescript
const persistentAtom = Atom.make(0).pipe(Atom.keepAlive);
```

### Idle TTL

Control cleanup delay:

```typescript
const atomWithDelay = Atom.make(value).pipe(Atom.setIdleTTL(1000));
```

### Finalizers

Cleanup resources when atom is disposed:

```typescript
const scrollAtom = Atom.make((get) => {
  const handler = () => get.setSelf(window.scrollY);
  window.addEventListener("scroll", handler);
  get.addFinalizer(() => window.removeEventListener("scroll", handler));
  return window.scrollY;
});
```

---

## Common Patterns

### Loading → Data → Error UI

```typescript
function MyComponent() {
  const result = useAtomValue(myAsyncAtom)

  return Result.builder(result)
    .onInitial(() => <Skeleton />)
    .onSuccess((data) => <DataView data={data} />)
    .onFailure((error) => <ErrorMessage error={error} />)
    .render()
}
```

### Conditional Rendering Based on Result

```typescript
const allVoted = Result.builder(votesResult)
  .onSuccess((votes) =>
    accounts.every((acc) => votes.some((v) => v.address === acc.address))
  )
  .onInitial(() => false)
  .onFailure(() => false)
  .render();

if (allVoted) return null;
```

### Chaining Effects with Dependencies

```typescript
runtime.atom(
  Effect.fnUntraced(function* (get) {
    // Wait for auth
    const user = yield* get.result(userAtom);

    // Then fetch user-specific data
    const service = yield* MyService;
    return yield* service.getDataForUser(user.id);
  })
);
```

---

## API Quick Reference

### Atom Creation

| Function                        | Use Case                   |
| ------------------------------- | -------------------------- |
| `Atom.make(value)`              | Simple writable atom       |
| `Atom.make((get) => ...)`       | Derived/computed atom      |
| `runtime.atom(Effect.gen(...))` | Async Effect-backed atom   |
| `runtime.fn(Effect.fn(...))`    | Function atom with args    |
| `Atom.family((arg) => atom)`    | Parameterized atom factory |
| `Atom.map(atom, fn)`            | Transform atom value       |

### Atom Modifiers

| Modifier                        | Effect               |
| ------------------------------- | -------------------- |
| `.pipe(Atom.keepAlive)`         | Prevent GC           |
| `.pipe(Atom.setIdleTTL(ms))`    | Custom cleanup delay |
| `.pipe(Atom.withLabel("name"))` | Debug label          |

### React Hooks

| Hook                    | Purpose                 |
| ----------------------- | ----------------------- |
| `useAtomValue(atom)`    | Subscribe and read      |
| `useAtomSet(atom)`      | Get setter function     |
| `useAtom(atom)`         | `[value, setter]` tuple |
| `useAtomSuspense(atom)` | Suspense integration    |
| `useAtomRefresh(atom)`  | Force re-computation    |
| `useAtomMount(atom)`    | Keep atom alive         |

### Result Helpers

| Function                       | Purpose                  |
| ------------------------------ | ------------------------ |
| `Result.isInitial(r)`          | Check loading state      |
| `Result.isSuccess(r)`          | Check success            |
| `Result.isFailure(r)`          | Check error              |
| `Result.getOrThrow(r)`         | Unwrap or throw          |
| `Result.getOrElse(r, default)` | Unwrap or default        |
| `Result.map(r, fn)`            | Transform success value  |
| `Result.builder(r)`            | Pattern matching builder |
