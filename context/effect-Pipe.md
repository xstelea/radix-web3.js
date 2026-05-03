# Effect Pipe — Deep Analysis

Comprehensive reference for Effect's `pipe` — the standalone function and the `.pipe()` method — covering when to use each, real codebase patterns, and common mistakes.

**Codebase stats**: ~88% method `.pipe()` / ~12% standalone `pipe()` across 28 files with pipe usage.

---

## Table of Contents

- [Why Pipe Exists](#why-pipe-exists)
- [Standalone vs Method .pipe()](#standalone-vs-method-pipe)
- [Pipeable Interface](#pipeable-interface)
- [Pipe Patterns by Domain](#pipe-patterns-by-domain)
- [pipe vs Effect.gen vs Effect.fn](#pipe-vs-effectgen-vs-effectfn)
- [flow vs pipe](#flow-vs-pipe)
- [Common Mistakes](#common-mistakes)
- [Quick Reference](#quick-reference)

---

## Why Pipe Exists

Without pipe, composing multiple transformations means deeply nested function calls that read **inside-out**:

```typescript
// Nested calls — read inside-out ❌
const result = Effect.flatMap(
  Effect.map(Effect.catchTag(myEffect, "NotFound", handleNotFound), transform),
  validate
);
```

Pipe restores **top-to-bottom reading order** — each step flows into the next:

```typescript
// Pipe — read top-to-bottom ✅
const result = myEffect.pipe(
  Effect.catchTag("NotFound", handleNotFound),
  Effect.map(transform),
  Effect.flatMap(validate)
);
```

This is especially important in Effect where chains of 5-10 operators are common. Pipe turns unreadable nesting into a linear pipeline where data flows downward.

---

## Standalone vs Method .pipe()

Effect provides **two forms** of pipe with identical behavior but different ergonomics.

### Standalone Function

Imported from `effect` or `effect/Function`. Takes an initial value as the first argument:

```typescript
import { pipe } from "effect";

// pipe(initialValue, fn1, fn2, fn3, ...)
const result = pipe(
  someArray, // initial value (any type)
  A.map((x) => x.name), // Array → Array
  A.filter((name) => name !== ""), // Array → Array
  A.head // Array → Option
);
```

### Method .pipe()

Called on any value implementing the `Pipeable` interface (Effect, Option, Layer, Schema, etc.):

```typescript
// value.pipe(fn1, fn2, fn3, ...)
const result = myEffect.pipe(
  Effect.map(transform),
  Effect.flatMap(validate),
  Effect.catchTag("NotFound", handleNotFound)
);
```

### When to Use Each

| Scenario                                           | Form                | Why                                           |
| -------------------------------------------------- | ------------------- | --------------------------------------------- |
| Starting from Effect/Option/Layer/Schema           | `.pipe()` method    | Already has `.pipe()`, cleaner syntax         |
| Starting from plain value (string, array, boolean) | Standalone `pipe()` | Plain values don't have `.pipe()`             |
| Inside `Effect.map` transforming a raw value       | Standalone `pipe()` | Callback receives plain value                 |
| Creating a reusable function                       | `flow()`            | Returns a function, doesn't apply immediately |

### Nested Combo Pattern

The codebase frequently nests standalone `pipe` inside method `.pipe()` — this happens when an Effect chain maps over a result that needs its own multi-step transformation:

```typescript
// From governanceComponent.ts — method .pipe() wraps standalone pipe()
getComponentStateService
  .run({ addresses: [config.componentAddress], ... })
  .pipe(                                         // method .pipe() on Effect
    Effect.map((result) =>
      pipe(                                      // standalone pipe() on array
        result,
        A.head,
        Option.map((item) => item.state),
        Option.getOrThrowWith(() => new ComponentStateNotFoundError({ ... }))
      )
    )
  )
```

The outer `.pipe()` chains Effect operators. The inner `pipe()` transforms the unwrapped plain value inside `Effect.map`.

---

## Pipeable Interface

Any type implementing `Pipeable` gets the `.pipe()` method. The interface is minimal:

```typescript
interface Pipeable {
  pipe<A>(this: A): A;
  pipe<A, B>(this: A, ab: (a: A) => B): B;
  pipe<A, B, C>(this: A, ab: (a: A) => B, bc: (b: B) => C): C;
  // ... up to ~20 overloads
}
```

**Types that implement Pipeable** (use `.pipe()` on these):

| Type              | Module          |
| ----------------- | --------------- |
| `Effect<A, E, R>` | `effect`        |
| `Option<A>`       | `effect/Option` |
| `Either<R, L>`    | `effect/Either` |
| `Layer<A, E, R>`  | `effect/Layer`  |
| `Schema<A, I, R>` | `effect/Schema` |
| `Config<A>`       | `effect/Config` |
| `Stream<A, E, R>` | `effect/Stream` |
| `Fiber<A, E>`     | `effect/Fiber`  |

---

## Pipe Patterns by Domain

### Effect Chaining (map / flatMap / catchTag)

The most common pattern — chaining Effect operators:

```typescript
// From temperatureChecksAtom.ts
const stateVersion =
  yield *
  ledgerState({
    at_ledger_state: { timestamp: new Date() },
  }).pipe(Effect.map((result) => StateVersion.make(result.state_version)));
```

Longer chains with error recovery:

```typescript
// From governanceComponent.ts — chain with nested transforms
keyValueStore({ at_ledger_state: { state_version }, address }).pipe(
  Effect.map((result) =>
    pipe(
      result.entries,
      A.map((entry) =>
        Effect.all([parseKey(entry), parseValue(entry)], {
          concurrency: 2,
        }).pipe(
          Effect.flatMap(([key, value]) =>
            Schema.decodeUnknownEither(TemperatureCheckSchema)({
              id: key,
              ...value,
            })
          )
        )
      )
    )
  ),
  Effect.flatMap(Effect.all) // Effect<Effect<T>[]> → Effect<T[]>
);
```

### Schema Branding & Validation

Schema uses `.pipe()` to compose schema transformers:

```typescript
// From schemas.ts — brand a string type
export const KeyValueStoreAddress = Schema.String.pipe(
  Schema.brand("KeyValueStoreAddress")
);

export type KeyValueStoreAddress = typeof KeyValueStoreAddress.Type;
```

### Layer Composition

Layers use `.pipe()` to wire dependencies:

```typescript
// From temperatureChecksAtom.ts
const runtime = makeAtomRuntime(
  Layer.mergeAll(
    GovernanceComponent.Default,
    GetLedgerStateService.Default,
    SendTransaction.Default
  ).pipe(
    Layer.provideMerge(RadixDappToolkit.Live), // provide shared dep
    Layer.provideMerge(StokenetGatewayApiClientLayer),
    Layer.provide(Config.StokenetLive) // provide config last
  )
);
```

The order matters: `Layer.provide` feeds dependencies **into** the layer above it. Read bottom-to-top for dependency direction: Config feeds into Gateway which feeds into the merged services.

### Option Chaining (Standalone pipe)

When transforming an Option value through multiple steps, standalone `pipe` reads cleanly:

```typescript
// From temperatureChecksAtom.ts — standalone pipe on Option chain
const temperatureCheckCreatedEvent =
  yield *
  pipe(
    events, // Option<Event[]>
    Option.flatMap((events) =>
      A.findFirst(events, (e) => e.name === "TemperatureCheckCreatedEvent")
    ), // Option<Event>
    Option.map((event) => event.data), // Option<SborData>
    Option.match({
      onSome: (sbor) => parseSbor(sbor, TemperatureCheckCreatedEvent),
      onNone: () => new EventNotFoundError({ message: "Event not found" }),
    }) // Effect<T, E>
  );
```

Notice how `pipe` bridges Option into Effect at the last step — `Option.match` returns an Effect on both branches.

### Config Defaults

Config values are Pipeable — use `.pipe()` with `Config.withDefault`:

```typescript
// From snapshot.ts
const concurrency =
  yield *
  Config.number("GET_ACCOUNT_BALANCES_CONCURRENCY").pipe(
    Config.withDefault(10)
  );
```

### Array + flow

`flow` creates a **reusable** transformation function (vs `pipe` which applies immediately):

```typescript
// From snapshot.ts — flow inside Effect.map
Effect.map(
  flow(
    A.reduce(
      R.empty<AccountAddress, Record<string, Amount>>(),
      (acc, position) => R.union(acc, position, (a, b) => ({ ...a, ...b }))
    )
  )
);
```

### Pure Value Pipelines (Either Chain)

Standalone `pipe` on plain values — no Effect involved:

```typescript
// From envVars.ts — pure synchronous pipeline, no Effect at all
export const envVars = pipe(
  EffectBoolean.match(isVitest, {
    onTrue: constant(vitestMockEnvVars),
    onFalse: constant({
      /* real env vars */
    }),
  }), // EnvVars.Encoded
  Schema.decodeUnknownEither(EnvVars), // Either<EnvVars, ParseError>
  Either.map((envVars) => ({
    ...envVars,
    EFFECTIVE_ENV: envVars.ENV === "local" ? "dev" : envVars.ENV,
  })), // Either<ExtendedEnvVars, ParseError>
  Either.getOrElse((parseIssue) => {
    throw new Error(
      `Invalid environment variables: ${TreeFormatter.formatErrorSync(parseIssue)}`
    );
  }) // ExtendedEnvVars (throws on Left)
);
```

This is a module-level constant — it runs once at import time, outside any Effect runtime.

---

## pipe vs Effect.gen vs Effect.fn

Three approaches for composing Effect operations. Each has a sweet spot:

```typescript
// pipe — linear transforms, no intermediate variables needed
const getUser = (id: string) =>
  fetchUser(id).pipe(
    Effect.map(normalize),
    Effect.flatMap(validate),
    Effect.catchTag("NotFound", () => Effect.succeed(defaultUser))
  );

// Effect.gen — need intermediate variables, branching logic, loops
const getUser = (id: string) =>
  Effect.gen(function* () {
    const raw = yield* fetchUser(id);
    const normalized = normalize(raw);
    if (!normalized.active) return defaultUser; // branching
    return yield* validate(normalized);
  });
```

### Decision Table

| Situation                       | Best Choice  | Why                              |
| ------------------------------- | ------------ | -------------------------------- |
| Linear A→B→C transforms         | `.pipe()`    | Most concise, no variable naming |
| Need intermediate variables     | `Effect.gen` | `yield*` binds to names          |
| Branching / conditional logic   | `Effect.gen` | Natural `if/else`, early return  |
| Loops over effects              | `Effect.gen` | `for...of` with `yield*`         |
| Service method returning Effect | `Effect.fn`  | Typed error channel, tracing     |
| Simple 1-2 step transform       | `.pipe()`    | Less overhead than generator     |
| Mixed: gen body + pipe tail     | Both         | `yield* someEffect.pipe(...)`    |

The codebase commonly **mixes** both — `Effect.gen` for the overall function body with `.pipe()` for individual transformations within it:

```typescript
// From governanceComponent.ts — gen + pipe together
const getTemperatureCheckById = (id: TemperatureCheckId) =>
  Effect.gen(function* () {
    const stateVersion = yield* getStateVersion()           // gen for binding

    const keyValueStoreAddress = yield* getComponentState(
      stateVersion
    ).pipe(                                                 // pipe for transform
      Effect.map((result) => KeyValueStoreAddress.make(result.temperature_checks))
    )

    const temperatureCheck = yield* keyValueStoreDataService({
      ...
    }).pipe(                                                // pipe for long chain
      Effect.map((result) => pipe(result, A.head, Option.flatMap(...))),
      Effect.flatMap((sbor) => parseSbor(sbor, Schema)),
      Effect.flatMap((parsed) => Schema.decodeUnknown(Schema)({ ...parsed, id }))
    )

    return temperatureCheck
  })
```

---

## flow vs pipe

Both compose functions left-to-right. The difference: **pipe applies immediately**, **flow returns a function**.

```typescript
import { flow, pipe } from "effect";

// pipe: apply NOW — returns a value
const result = pipe(5, double, addOne); // 11

// flow: create function — returns (x) => addOne(double(x))
const transform = flow(double, addOne);
transform(5); // 11
```

**Use `flow`** when you need a reusable transformation or a callback:

```typescript
// From snapshot.ts — flow as an argument to Effect.map
Effect.map(
  flow(
    A.reduce(R.empty<AccountAddress, Record<string, Amount>>(), mergePositions)
  )
);

// Equivalent without flow (more verbose):
Effect.map((positions) =>
  pipe(
    positions,
    A.reduce(R.empty<AccountAddress, Record<string, Amount>>(), mergePositions)
  )
);
```

`flow` saves you from naming the intermediate parameter when the function is used as a callback.

---

## Common Mistakes

### 1. Forgetting Standalone pipe Import

```typescript
// ❌ ReferenceError: pipe is not defined
const result = pipe(
  myArray,
  A.head,
  Option.getOrElse(() => fallback)
);

// ✅ Import pipe from "effect" or "effect/Function"
import { pipe } from "effect";
const result = pipe(
  myArray,
  A.head,
  Option.getOrElse(() => fallback)
);
```

The standalone `pipe` function is a named export — it doesn't come from any module's namespace. If you're using `import { Effect } from "effect"`, you still need to add `pipe` to the import list.

### 2. Using Standalone pipe on Pipeable Types

```typescript
// ❌ Works but unnecessarily verbose
import { pipe } from "effect";
const result = pipe(myEffect, Effect.map(transform), Effect.flatMap(validate));

// ✅ Use method .pipe() — cleaner, no import needed
const result = myEffect.pipe(Effect.map(transform), Effect.flatMap(validate));
```

If the starting value already has `.pipe()` (Effect, Option, Layer, etc.), prefer the method form. Reserve standalone `pipe` for plain values.

### 3. Double-Calling Functions (Passing Called fn Instead of fn Ref)

```typescript
// ❌ Calls the function immediately, passes result as operator
myEffect.pipe(
  Effect.map(transform(x)), // ← transform(x) is called NOW, result passed to map
  Effect.flatMap(validate()) // ← validate() called NOW
);

// ✅ Pass function references — they get called by map/flatMap
myEffect.pipe(
  Effect.map(transform), // ← map will call transform(value)
  Effect.flatMap(validate) // ← flatMap will call validate(value)
);

// ✅ Or use arrow functions for multi-arg transforms
myEffect.pipe(Effect.map((value) => transform(value, extraArg)));
```

This is subtle: `Effect.map(fn)` expects a function `A → B`. If you write `Effect.map(fn(x))`, you're passing the **return value** of `fn(x)` which is a value, not a function.

### 4. Splitting Chains Across Variables (Loses Inference)

```typescript
// ❌ TypeScript may widen or lose type inference at each variable
const step1 = myEffect.pipe(Effect.map(transform));
const step2 = step1.pipe(Effect.flatMap(validate));
const step3 = step2.pipe(Effect.catchTag("NotFound", handleNotFound));

// ✅ Single chain — TypeScript infers the full pipeline type
const result = myEffect.pipe(
  Effect.map(transform),
  Effect.flatMap(validate),
  Effect.catchTag("NotFound", handleNotFound)
);
```

Effect's type inference works best with a single continuous chain. Breaking into variables can cause the error channel to widen or requirements to get lost. If you need intermediate variables, use `Effect.gen` with `yield*` instead.

### 5. Using Effect.gen for Simple Linear Transforms

```typescript
// ❌ Overkill — generator for a simple map
const getName = (id: string) =>
  Effect.gen(function* () {
    const user = yield* fetchUser(id);
    return user.name;
  });

// ✅ pipe is more concise for linear transforms
const getName = (id: string) =>
  fetchUser(id).pipe(Effect.map((user) => user.name));
```

If the body is just `yield* X` followed by `return transform(result)` with no branching, `.pipe(Effect.map(...))` is simpler.

---

## Quick Reference

### Two Forms

| Form                | Syntax                  | Starting Value            | Import                          |
| ------------------- | ----------------------- | ------------------------- | ------------------------------- |
| Standalone function | `pipe(value, fn1, fn2)` | Any value                 | `import { pipe } from "effect"` |
| Method              | `value.pipe(fn1, fn2)`  | Must implement `Pipeable` | None (built-in)                 |
| Flow (related)      | `flow(fn1, fn2)`        | N/A — returns function    | `import { flow } from "effect"` |

### Codebase Patterns Summary

| Pattern                             | Form                | Example Location                        |
| ----------------------------------- | ------------------- | --------------------------------------- |
| Effect chaining                     | `.pipe()`           | `governanceComponent.ts` — most methods |
| Layer composition                   | `.pipe()`           | `temperatureChecksAtom.ts:34-43`        |
| Schema branding                     | `.pipe()`           | `schemas.ts:68-69`                      |
| Config defaults                     | `.pipe()`           | `snapshot.ts:38-40`                     |
| Option chain                        | `pipe()` standalone | `temperatureChecksAtom.ts:112-128`      |
| Array→Option transform              | `pipe()` standalone | `governanceComponent.ts:90-100`         |
| Pure value pipeline                 | `pipe()` standalone | `envVars.ts:26-46`                      |
| Reusable transform                  | `flow()`            | `snapshot.ts:73-79`                     |
| Nested pipe (Effect wrapping plain) | Both                | `governanceComponent.ts:88-101`         |
