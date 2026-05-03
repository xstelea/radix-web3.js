# Effect Layer — Deep Analysis

Comprehensive reference for Effect's `Layer<ROut, E, RIn>` — the composable, memoized blueprint for building service dependency graphs. Covers type signature, constructors, composition algebra, internal primitives, scope management, and real codebase patterns.

---

## Table of Contents

- [Type Signature & Variance](#type-signature--variance)
- [Constructors](#constructors)
- [Composition: The Four Key Operations](#composition-the-four-key-operations)
- [Internal Architecture](#internal-architecture)
- [MemoMap: Automatic Sharing](#memomap-automatic-sharing)
- [Scope Hierarchy & Parallel Execution](#scope-hierarchy--parallel-execution)
- [Error Handling](#error-handling)
- [fresh() — Bypassing Memoization](#fresh--bypassing-memoization)
- [Codebase Patterns](#codebase-patterns)
- [Common Mistakes & Gotchas](#common-mistakes--gotchas)
- [Quick Reference](#quick-reference)

---

## Type Signature & Variance

```typescript
interface Layer<in ROut, out E = never, out RIn = never>
//               ^           ^            ^
//               |           |            └── Requirements (services this layer NEEDS)
//               |           └─────────────── Error type (can fail with)
//               └─────────────────────────── Output (services this layer PROVIDES)
```

### Variance explained

| Parameter | Variance                 | Meaning                                                                                           |
| --------- | ------------------------ | ------------------------------------------------------------------------------------------------- |
| `ROut`    | **Contravariant** (`in`) | A `Layer<A \| B, ...>` can substitute where `Layer<A, ...>` is expected — wider output is subtype |
| `E`       | **Covariant** (`out`)    | Standard error widening — `Layer<_, E1, _>` is subtype of `Layer<_, E1 \| E2, _>`                 |
| `RIn`     | **Covariant** (`out`)    | Fewer requirements = more general — `Layer<_, _, never>` fits anywhere                            |

The contravariance of `ROut` is the key insight: a layer that provides **more** services is assignable to a slot expecting fewer. This enables safe substitution — you can always provide a "richer" layer.

### Reading the signature

Think of `Layer<ROut, E, RIn>` as a recipe:

- **Input** (`RIn`): what ingredients it needs
- **Output** (`ROut`): what it produces
- **Error** (`E`): how it can fail

When `RIn = never`, the layer needs nothing — it's self-contained and ready to build.

---

## Constructors

### `Layer.succeed(tag, value)` — Immediate value

Creates a layer from an already-existing value. No effects, no cleanup.

```typescript
const ConfigLive = Layer.succeed(Config, {
  apiUrl: "https://...",
  logLevel: "INFO",
});
// Layer<Config, never, never> — no deps, no errors
```

### `Layer.sync(tag, () => value)` — Lazy synchronous

Like `succeed` but defers evaluation. Useful when the value depends on runtime state.

```typescript
const ConfigLive = Layer.sync(Config, () => ({ apiUrl: process.env.API_URL! }));
```

### `Layer.effect(tag, effect)` — Effectful construction

Builds a service from an Effect. The Effect can access other services (tracked in `RIn`), can fail, and runs once per MemoMap.

```typescript
const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function* () {
    const config = yield* Config;
    return { query: (sql) => Effect.succeed([]) };
  })
);
// Layer<Database, never, Config>
```

### `Layer.scoped(tag, effect)` — Resource with lifecycle

Like `effect`, but the Effect can use `Scope` — resources are acquired and released when the layer's scope closes. `Scope` is excluded from `RIn` automatically.

```typescript
const ConnectionLive = Layer.scoped(
  Connection,
  Effect.gen(function* () {
    const conn = yield* Effect.acquireRelease(
      Effect.sync(() => createConnection()),
      (conn) => Effect.sync(() => conn.close())
    );
    return { conn };
  })
);
// Layer<Connection, never, never> — Scope is excluded from RIn
```

### `Layer.context<R>()` — Pass-through identity

Creates a layer that requires `R` and outputs `R` unchanged. Used internally by `provide` and `passthrough`.

```typescript
const passConfig = Layer.context<Config>();
// Layer<Config, never, Config> — identity
```

### `Layer.unwrapEffect(effect)` — Dynamic layer from Effect

When you need to compute which layer to use at runtime. The outer Effect produces a Layer.

```typescript
const DynamicDb = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* Config;
    return config.usePostgres ? PostgresLive : SqliteLive;
  })
);
```

### `Layer.suspend(() => layer)` — Lazy / self-referential

Defers layer construction. Required for recursive or self-referential layer definitions.

---

## Composition: The Four Key Operations

These four operations form the algebra for wiring layers together. Understanding their type-level behavior is essential.

### `Layer.merge(A, B)` / `Layer.mergeAll(A, B, C, ...)`

**Horizontal composition** — combine independent layers side-by-side. Both execute concurrently (via `ZipWithPar` / `MergeAll` primitives).

```typescript
// Type algebra:
// merge: Layer<ROut1, E1, RIn1> + Layer<ROut2, E2, RIn2>
//      → Layer<ROut1 | ROut2, E1 | E2, RIn1 | RIn2>
```

Outputs are **unioned** (both available), inputs are **unioned** (both needed), errors are **unioned** (either can fail).

```typescript
const ServicesLayer = Layer.mergeAll(
  GovernanceComponent.Default,
  GovernanceEventProcessor.Default,
  Snapshot.Default,
  GetLedgerStateService.Default,
  VoteCalculation.Default,
  StartupReconciliation.Default,
  TriggerConsumer.Default,
  TransactionListener.Default
);
```

### `Layer.provide(self, that)` — Vertical wiring (outputs consumed)

Feeds `that`'s output into `self`'s input requirements. `that`'s output does **not** appear in the final layer's output — it is consumed internally.

```typescript
// Type algebra (pipe form: self.pipe(Layer.provide(that))):
// self: Layer<ROut2, E2, RIn2>     (consumer)
// that: Layer<ROut,  E,  RIn>      (provider)
//     → Layer<ROut2, E | E2, RIn | Exclude<RIn2, ROut>>
```

Key: `Exclude<RIn2, ROut>` — whatever `that` provides is removed from `self`'s requirements. Only unsatisfied requirements remain.

```typescript
const BaseServicesLayer = Layer.mergeAll(
  GovernanceComponent.Default,
  Snapshot.Default
  // ...
).pipe(
  Layer.provide(ORM.Default), // ORM consumed internally
  Layer.provide(StokenetGatewayApiClientLayer) // Gateway consumed internally
);
// Output: all merged services. ORM and Gateway are NOT in the output.
```

### `Layer.provideMerge(self, that)` — Vertical wiring (outputs preserved)

Like `provide`, but `that`'s output **also appears** in the final output — it flows through to downstream consumers.

```typescript
// Type algebra (pipe form: self.pipe(Layer.provideMerge(that))):
// self: Layer<ROut2, E2, RIn2>     (consumer)
// that: Layer<ROut,  E,  RIn>      (provider)
//     → Layer<ROut | ROut2, E | E2, RIn | Exclude<RIn2, ROut>>
//        ^^^^^^^^^^^
//        BOTH outputs exposed
```

The difference from `provide`: the output type is `ROut | ROut2` instead of just `ROut2`.

```typescript
const BaseServicesLayer = Layer.mergeAll(
  GovernanceComponent.Default
  // ...
).pipe(
  Layer.provide(ORM.Default),
  Layer.provide(StokenetGatewayApiClientLayer),
  Layer.provideMerge(Config.StokenetLive) // Config IS in the output
);
// The main program can also access Config because provideMerge was used
```

### When to use `provide` vs `provideMerge`

| Scenario                                     | Use                    | Why                                                        |
| -------------------------------------------- | ---------------------- | ---------------------------------------------------------- |
| Internal dependency only                     | `provide`              | Downstream doesn't need it                                 |
| Shared dependency needed by main program too | `provideMerge`         | Keeps output in the layer's type                           |
| Config service                               | Usually `provideMerge` | Often needed by both layers AND the main effect            |
| Database / ORM                               | Usually `provide`      | Internal plumbing, main program uses higher-level services |
| Ref-based mutable state                      | `provideMerge`         | Main program may need to read/mutate the Ref               |

---

## Internal Architecture

### 10 Primitive Operations

Every `Layer` is internally a tagged union of these primitives. All composition functions (like `merge`, `provide`) construct trees of these nodes, which are "compiled" at build time by `makeBuilder`.

| Primitive     | Opcode           | Purpose                                          |
| ------------- | ---------------- | ------------------------------------------------ |
| `FromEffect`  | `"FromEffect"`   | Wraps an `Effect` that produces a `Context`      |
| `Scoped`      | `"Scoped"`       | Like `FromEffect` but extends scope lifetime     |
| `Suspend`     | `"Suspend"`      | Lazy thunk — defers layer construction           |
| `Fresh`       | `"Fresh"`        | Wraps a layer, disabling MemoMap caching         |
| `Fold`        | `"Fold"`         | Error handling — branches on success/failure     |
| `ProvideTo`   | `"Provide"`      | Sequential: build first, feed into second        |
| `ZipWith`     | `"ProvideMerge"` | Sequential: build first, zip contexts            |
| `ZipWithPar`  | `"ZipWith"`      | Parallel: build both concurrently, zip contexts  |
| `MergeAll`    | `"MergeAll"`     | Parallel: build N layers concurrently, merge all |
| `Locally`     | `"Locally"`      | FiberRef modification during layer construction  |
| `ExtendScope` | `"ExtendScope"`  | Extends resource lifetime beyond layer scope     |

### `makeBuilder` — The Interpreter

`makeBuilder(layer, scope, inMemoMap?)` is the core interpreter that walks the primitive tree:

```
makeBuilder: Layer → Scope → Effect<(MemoMap) → Effect<Context>>
```

It returns a **function** `(MemoMap) → Effect<Context>` — this two-phase design enables the MemoMap to be threaded through without being part of the layer's type.

For each primitive:

- **FromEffect/Scoped**: If inside MemoMap, execute directly. Otherwise, delegate to `memoMap.getOrElseMemoize(self, scope)`.
- **Provide**: Build first, then build second with first's context provided.
- **ProvideMerge (ZipWith)**: Build first, then zip with second sequentially.
- **ZipWithPar**: Fork a parallel scope, build both concurrently, zip results.
- **MergeAll**: Fork parallel scope, build all layers concurrently, merge contexts.
- **Fresh**: Bypasses MemoMap — calls `buildWithScope` directly.
- **Fold**: Build inner layer, match on success/failure, recurse.

---

## MemoMap: Automatic Sharing

By default, layers are **shared** (memoized). If the same `Layer` object appears multiple times in a composition tree, it is built only once. The result is cached in a `MemoMap`.

### How it works

`MemoMap` is a `SynchronizedRef<Map<Layer, [Effect, Finalizer]>>`:

1. **First access**: Build the layer, store `[Deferred, Finalizer]` in map. Subsequent accesses await the Deferred.
2. **Observer counting**: Each scope that accesses a memoized layer increments an observer counter. The inner scope is only closed when the last observer's scope closes.
3. **Identity-based keys**: The `Map` uses layer **object identity** as keys. Two structurally identical layers created separately are **not** shared — only the same object reference triggers sharing.

### Implications

- **Diamond dependencies are free**: If `A` and `B` both depend on `Config`, and you `merge(A, B)`, Config is built once.
- **Order doesn't matter for sharing**: The MemoMap handles any DAG shape.
- **Scope cleanup is ref-counted**: Resources are released when the last consumer's scope closes.

---

## Scope Hierarchy & Parallel Execution

When layers execute in parallel (via `merge`, `mergeAll`, or `ZipWithPar`), Effect creates a **parallel scope hierarchy**:

```
parentScope
  └── parallelScope (forked with ExecutionStrategy.parallel)
       ├── scope1 (forked with sequential) → Layer A
       └── scope2 (forked with sequential) → Layer B
```

Each parallel layer gets its own sequential scope. This ensures:

- Parallel layers don't interfere with each other's resource cleanup
- If one fails, the parallel scope can clean up all siblings
- Finalizers within a single layer run sequentially (predictable order)

For `MergeAll`, the structure is:

```
parentScope
  └── parallelScope
       ├── scope[0] → Layer 0
       ├── scope[1] → Layer 1
       └── scope[N] → Layer N
```

All N layers execute concurrently via `forEachConcurrentDiscard`.

---

## Error Handling

### `Layer.catchAll(self, onError)`

Recovers from all errors. The recovery function receives the error and returns a fallback layer.

```typescript
const ResilientDb = DatabaseLive.pipe(
  Layer.catchAll((error) => FallbackDatabaseLive)
);
```

### `Layer.orDie(self)`

Converts layer errors into defects (fiber death). Removes `E` from the type — all errors become unchecked.

```typescript
const UnsafeDb = DatabaseLive.pipe(Layer.orDie);
// Layer<Database, never, Config> — error channel is never
```

### `Layer.retry(self, schedule)`

Retries layer construction according to a schedule. Internally uses `fresh()` on each retry attempt to bypass the MemoMap cache — otherwise the memoized failure would be returned immediately without re-executing.

```typescript
const RetryingDb = DatabaseLive.pipe(
  Layer.retry(
    Schedule.exponential("1 second").pipe(
      Schedule.union(Schedule.spaced("30 seconds")) // caps backoff at 30s
    )
  )
);
```

---

## `fresh()` — Bypassing Memoization

`Layer.fresh(layer)` wraps a layer with the `Fresh` primitive. When the builder encounters `Fresh`, it **skips the MemoMap** and calls `buildWithScope` directly — creating a new instance every time.

```typescript
// Each call creates a separate connection pool
const FreshPool = Layer.fresh(ConnectionPoolLive);
```

Use `fresh()` when:

- You need **separate instances** of a service (e.g., multiple connection pools)
- Inside `retry` loops (done automatically — `retryLoop` calls `fresh()` on each iteration)
- Testing — force re-initialization between test cases

---

## Codebase Patterns

### Pattern: Layer cake with `provideMerge` for shared Config

From `apps/vote-collector/src/index.ts`:

```typescript
// Domain services — provideMerge so Config is available to both internal services and the main program
const BaseServicesLayer = Layer.mergeAll(
  GovernanceComponent.Default,
  GovernanceEventProcessor.Default,
  Snapshot.Default,
  GetLedgerStateService.Default,
  VoteCalculation.Default,
  StartupReconciliation.Default,
  TriggerConsumer.Default,
  TransactionListener.Default
).pipe(
  Layer.provide(ORM.Default), // ORM consumed internally
  Layer.provide(StokenetGatewayApiClientLayer), // Gateway consumed internally
  Layer.provideMerge(Config.StokenetLive) // Config ALSO available to main program
);
```

Read bottom-to-top for dependency direction: Config feeds into Gateway, which feeds into ORM, which feeds into the merged services.

### Pattern: `provideMerge` for Ref-based mutable state

```typescript
// provideMerge so TransactionStreamConfig ref is accessible to transactionListener for cursor mutation
const TransactionStreamLayer = TransactionStreamService.Default.pipe(
  Layer.provideMerge(TransactionStreamConfigLayer), // Ref exposed for mutation
  Layer.provide(StokenetGatewayApiClientLayer)
);
```

The `TransactionStreamConfig` is a `Ref<Config>` — the transaction listener needs to mutate it (update the cursor position). Using `provideMerge` keeps the Ref in the output so the main program's `TransactionListener` can access it.

### Pattern: Composing the final application layer

```typescript
const AppLayer = BaseServicesLayer.pipe(
  Layer.provideMerge(TransactionStreamLayer),
  Layer.provideMerge(PgClientLive),
  Layer.provideMerge(DedupBuffer.Default)
);

// Usage: Effect.provide(program, AppLayer)
NodeRuntime.runMain(
  Effect.gen(function* () {
    // All services available: StartupReconciliation, TriggerConsumer,
    // TransactionListener, Config, TransactionStreamConfig, DedupBuffer, etc.
    const reconcile = yield* StartupReconciliation;
    const startingStateVersion = yield* reconcile();
    // ...
  }).pipe(Effect.provide(AppLayer))
);
```

### Pattern: `Layer.effect` for Ref-backed config

```typescript
const TransactionStreamConfigLayer = Layer.effect(
  TransactionStreamConfig,
  Ref.make<typeof TransactionStreamConfigSchema.Type>({
    stateVersion: Option.none(),
    limitPerPage: 100,
    waitTime: Duration.seconds(10),
    optIns: { affected_global_entities: true, detailed_events: true },
  })
);
```

Note the explicit type annotation on `Ref.make<ExplicitType>({...})` — without it, TypeScript infers literal types (e.g., `100` instead of `number`, `true` instead of `boolean`), which makes the `Ref` invariant type mismatch.

---

## Common Mistakes & Gotchas

### 1. `provide` when you needed `provideMerge`

```typescript
// ❌ Config is consumed — main program can't access it
const layer = ServicesLayer.pipe(Layer.provide(ConfigLive));

// In main program:
const config = yield * Config; // TypeScript error: Config not in R

// ✅ Config flows through to output
const layer = ServicesLayer.pipe(Layer.provideMerge(ConfigLive));
```

**Rule of thumb**: If the main effect `yield*`s the service, use `provideMerge`. If only internal layers need it, use `provide`.

### 2. `Ref.make` without explicit type annotation

```typescript
// ❌ Infers Ref<{ stateVersion: Option.None; limitPerPage: 100; ... }>
//    (literal types — won't match Ref<{ stateVersion: Option.Option<number>; limitPerPage: number; ... }>)
Layer.effect(Tag, Ref.make({ stateVersion: Option.none(), limitPerPage: 100 }));

// ✅ Explicit type parameter forces wider types
Layer.effect(
  Tag,
  Ref.make<ConfigType>({ stateVersion: Option.none(), limitPerPage: 100 })
);
```

This is because `Ref<A>` is **invariant** in `A` — the inferred literal type `100` doesn't match `number`.

### 3. Tag key collisions across packages

`Context.Tag(key)` uses `Symbol.for(key)` internally — the key must be globally unique across **all** packages in the monorepo.

```typescript
// ❌ Both packages use 'Config' — they share the same Symbol!
// In package A:
class Config extends Context.Tag("Config")<Config, ConfigA>() {}
// In package B:
class Config extends Context.Tag("Config")<Config, ConfigB>() {}

// ✅ Use unique, namespaced keys
class Config extends Context.Tag("GovernanceConfig")<Config, ConfigA>() {}
class Config extends Context.Tag("TransactionStreamConfig")<
  Config,
  ConfigB
>() {}
```

### 4. Layer.provide order confusion

```typescript
// Layer.provide(self, that) — "that" provides TO "self"
// In pipe form: self.pipe(Layer.provide(that)) — "that" feeds into "self"

// ❌ Wrong mental model: "provide" sounds like "self provides to that"
ServicesLayer.pipe(Layer.provide(ConfigLive));
// Actually means: ConfigLive provides TO ServicesLayer

// ✅ Read as: "ServicesLayer, provided by ConfigLive"
// Or read bottom-to-top: Config → Services
```

### 5. Using `Layer.succeed` for async initialization

```typescript
// ❌ Layer.succeed is synchronous — can't await
const DbLive = Layer.succeed(Database, await connectToDb());

// ✅ Use Layer.effect for async
const DbLive = Layer.effect(
  Database,
  Effect.promise(() => connectToDb())
);

// ✅ Or Layer.scoped for resources needing cleanup
const DbLive = Layer.scoped(
  Database,
  Effect.acquireRelease(
    Effect.promise(() => connectToDb()),
    (conn) => Effect.sync(() => conn.close())
  )
);
```

### 6. Expecting `merge` to wire dependencies

```typescript
// ❌ merge is horizontal — B's dependencies aren't satisfied by A
const wrong = Layer.merge(ConfigLive, DatabaseLive);
// DatabaseLive still requires Config — it's not wired!

// ✅ Use provide for vertical wiring
const correct = DatabaseLive.pipe(Layer.provide(ConfigLive));
```

`merge` combines independent layers. `provide` wires dependencies.

---

## Quick Reference

### Constructors

| Constructor              | Input                       | Use When                            |
| ------------------------ | --------------------------- | ----------------------------------- |
| `succeed(tag, value)`    | Immediate value             | Simple config objects               |
| `sync(tag, () => value)` | Lazy sync thunk             | Runtime-dependent values            |
| `effect(tag, effect)`    | Effectful `Effect<S, E, R>` | Async init, needs other services    |
| `scoped(tag, effect)`    | Scoped `Effect<S, E, R>`    | Resources needing cleanup           |
| `context<R>()`           | None                        | Pass-through identity layer         |
| `unwrapEffect(effect)`   | `Effect<Layer<...>>`        | Dynamic layer selection             |
| `suspend(() => layer)`   | Lazy thunk                  | Recursive / self-referential layers |

### Composition

| Operation                  | Direction  | Output includes provider? | Execution  |
| -------------------------- | ---------- | ------------------------- | ---------- |
| `merge(A, B)`              | Horizontal | N/A (both are output)     | Concurrent |
| `mergeAll(A, B, C)`        | Horizontal | N/A                       | Concurrent |
| `provide(self, that)`      | Vertical   | No — consumed             | Sequential |
| `provideMerge(self, that)` | Vertical   | Yes — flows through       | Sequential |

### Error Handling

| Operation                      | Effect                                          |
| ------------------------------ | ----------------------------------------------- |
| `catchAll(self, onError)`      | Recover from all errors                         |
| `catchAllCause(self, onCause)` | Recover from all causes                         |
| `orDie(self)`                  | Convert errors to defects                       |
| `orElse(self, that)`           | Fallback to another layer                       |
| `retry(self, schedule)`        | Retry with schedule (uses `fresh()` internally) |

### Type Algebra Cheat Sheet

```
merge(A, B):         Output = A | B,  Error = EA | EB,  Input = RA | RB
provide(self, that): Output = self,   Error = E1 | E2,  Input = Rthat | Exclude<Rself, Outthat>
provideMerge(s, t):  Output = s | t,  Error = E1 | E2,  Input = Rt | Exclude<Rs, Outt>
```
