# Effect Context Module - Deep Analysis

## Overview

The `Context` module in Effect is the foundation for **dependency injection** and **type-safe service composition**. It provides a way to:

1. Define services as typed "tags" (unique identifiers)
2. Build a container (`Context<R>`) holding service implementations
3. Track dependencies at the type level via the `R` (Requirements) type parameter
4. Provide implementations to effects at runtime

---

## The Effect Type Signature

```typescript
Effect<Success, Error, Requirements>;
//      ^        ^       ^
//      |        |       └── Contextual dependencies (services needed)
//      |        └────────── Error type (can fail with)
//      └─────────────────── Success type (succeeds with)
```

The `Requirements` parameter (`R`) tracks which services an Effect needs. When `R = never`, the effect has no dependencies and can run immediately.

---

## Core Concepts

### Context.Tag - Defining Services

`Context.Tag` creates a unique identifier for a service. It's a type-level marker that connects:

- A **service identifier** (the tag itself)
- A **service interface** (what the service provides)

```typescript
import { Context, Effect } from "effect";

// Define a service tag
class Random extends Context.Tag("MyRandomService")<
  Random, // Tag identifier type
  { readonly next: Effect.Effect<number> } // Service interface
>() {}
```

**Key insight**: The string `"MyRandomService"` is a runtime identifier for debugging. The type system uses the class itself (`Random`) as the unique key.

### Using a Service

Once defined, yield the tag in `Effect.gen` to access the service:

```typescript
const program = Effect.gen(function* () {
  const random = yield* Random; // Accesses the service
  const value = yield* random.next; // Uses service methods
  return value;
});
// Type: Effect<number, never, Random>
//                              ^^^^^
//                              Requires Random service
```

### Providing Services

Use `Effect.provideService` to supply an implementation:

```typescript
const runnable = Effect.provideService(program, Random, {
  next: Effect.sync(() => Math.random()),
});
// Type: Effect<number, never, never>
//                              ^^^^^
//                              No more requirements!
```

---

## Two Patterns: Context.Tag vs Effect.Service

### Pattern 1: Context.Tag (Lower-Level)

Direct tag definition. Requires manual Layer creation.

```typescript
class Database extends Context.Tag("Database")<
  Database,
  { readonly query: (sql: string) => Effect.Effect<Array<unknown>> }
>() {}

// Create layer manually
const DatabaseLive = Layer.succeed(Database, {
  query: (sql) => Effect.succeed([]),
});
```

**Use when**:

- Simple services without complex initialization
- Middleware patterns (providing services dynamically)
- Maximum control over layer composition

### Pattern 2: Effect.Service (Higher-Level)

All-in-one service definition with built-in layer and optional accessors.

```typescript
class Logger extends Effect.Service<Logger>()("Logger", {
  // Generates accessors (Logger.info instead of logger.info)
  accessors: true,

  // Service implementation (effectful)
  effect: Effect.gen(function* () {
    return {
      info: (msg: string) => Effect.log(msg),
    };
  }),

  // Dependencies this service needs
  dependencies: [OtherService.Default],
}) {}
```

**Use when**:

- Services with dependencies on other services
- Services needing lifecycle management (scoped)
- You want auto-generated `Default` layer and accessors

### Comparison Table

| Feature          | Context.Tag | Effect.Service       |
| ---------------- | ----------- | -------------------- |
| Boilerplate      | Minimal     | Slightly more        |
| Auto Layer       | No          | Yes (`.Default`)     |
| Accessors        | No          | Optional             |
| Dependencies     | Manual      | Declarative          |
| Scoped lifecycle | Manual      | Built-in (`scoped:`) |

---

## Service Construction Options

`Effect.Service` supports three construction modes:

```typescript
// 1. Sync constructor - simple, immediate value
class Config extends Effect.Service<Config>()("Config", {
  sync: () => ({ apiUrl: "https://api.example.com" }),
}) {}

// 2. Effect constructor - async/effectful initialization
class Database extends Effect.Service<Database>()("Database", {
  effect: Effect.gen(function* () {
    const config = yield* Config;
    return { query: (sql: string) => Effect.succeed([]) };
  }),
  dependencies: [Config.Default],
}) {}

// 3. Scoped constructor - lifecycle with cleanup
class Connection extends Effect.Service<Connection>()("Connection", {
  scoped: Effect.gen(function* () {
    const conn = yield* Effect.acquireRelease(
      Effect.sync(() => createConnection()),
      (conn) => Effect.sync(() => conn.close())
    );
    return { conn };
  }),
}) {}
```

---

## Layer Composition

Layers are blueprints for building `Context` values. They compose services together.

### Creating Layers

```typescript
// From simple value
const ConfigLive = Layer.succeed(Config, { logLevel: "INFO" });

// From effectful computation
const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function* () {
    const config = yield* Config;
    return { query: () => Effect.succeed([]) };
  })
);

// From scoped resource
const ConnectionLive = Layer.scoped(
  Connection,
  Effect.gen(function* () {
    yield* Effect.addFinalizer(() => Effect.log("Cleanup"));
    return {
      /* ... */
    };
  })
);
```

### Composing Layers

```typescript
// Vertical: A provides to B
const AppLayer = DatabaseLive.pipe(
  Layer.provide(ConfigLive) // Config feeds into Database
);

// Horizontal: Merge independent layers
const CombinedLayer = Layer.merge(LoggerLive, MetricsLive);

// Full application layer
const MainLayer = Layer.mergeAll(DatabaseLive, LoggerLive, CacheLive).pipe(
  Layer.provide(ConfigLive) // Shared dependency
);
```

---

## Type-Level Dependency Tracking

Effect's type system ensures you can't run an effect without providing all dependencies:

```typescript
const program: Effect<User, DbError, Database | Logger> = Effect.gen(
  function* () {
    const db = yield* Database;
    const logger = yield* Logger;
    // ...
  }
);

// Providing Database removes it from requirements
const partial = Effect.provide(program, DatabaseLive);
// Type: Effect<User, DbError, Logger>

// Must provide Logger too
const runnable = Effect.provide(partial, LoggerLive);
// Type: Effect<User, DbError, never>

// Now it can run!
Effect.runPromise(runnable);
```

**Compiler enforces**: No missing dependencies at runtime.

---

## Context Operations

The `Context` module provides low-level operations (rarely used directly):

| Function                           | Purpose                            |
| ---------------------------------- | ---------------------------------- |
| `Context.empty()`                  | Create empty context               |
| `Context.make(tag, value)`         | Create context with single service |
| `Context.add(context, tag, value)` | Add service to context             |
| `Context.get(context, tag)`        | Get service (Option)               |
| `Context.unsafeGet(context, tag)`  | Get service (throws if missing)    |
| `Context.merge(ctx1, ctx2)`        | Combine two contexts               |

Most code uses `Layer` and `Effect.provide*` instead of raw Context operations.

---

## Real-World Patterns

### Pattern: Service with Ref (Mutable State)

```typescript
class Counter extends Context.Tag("Counter")<Counter, Ref.Ref<number>>() {
  static Live = Layer.scoped(this, Ref.make(0));
}
```

### Pattern: Factory Service

```typescript
class SendTransaction extends Effect.Service<SendTransaction>()(
  "SendTransaction",
  {
    effect: Effect.gen(function* () {
      const rdt = yield* RadixDappToolkit;

      // Return a function, not a value
      return Effect.fn(function* (manifest: string) {
        const toolkit = yield* Ref.get(rdt);
        return yield* toolkit.send(manifest);
      });
    }),
  }
) {}
```

### Pattern: Scoped Resource with Finalizer

```typescript
class RadixDappToolkit extends Context.Tag("RadixDappToolkit")<
  RadixDappToolkit,
  Ref.Ref<RadixDappToolkitFactory>
>() {
  static Live = Layer.scoped(
    this,
    Effect.gen(function* () {
      const rdt = RadixDappToolkitFactory({
        /* config */
      });

      // Register cleanup
      yield* Effect.addFinalizer(() => Effect.sync(() => rdt.destroy()));

      return yield* Ref.make(rdt);
    })
  );
}
```

---

## Common Mistakes

### 1. Forgetting to yield the tag

```typescript
// Wrong - tag not yielded
const program = Effect.gen(function* () {
  const value = Database.query("SELECT 1"); // Oops!
});

// Correct
const program = Effect.gen(function* () {
  const db = yield* Database;
  const value = yield* db.query("SELECT 1");
});
```

### 2. Providing layers in wrong order

```typescript
// If B depends on A, provide A first (or use Layer.provide)
const wrong = Layer.merge(BLive, ALive); // B can't find A
const correct = BLive.pipe(Layer.provide(ALive));
```

### 3. Mixing async initialization with sync Layer

```typescript
// Wrong - Layer.succeed can't handle async
const DbLive = Layer.succeed(Database, await connectToDb());

// Correct - use Layer.effect
const DbLive = Layer.effect(
  Database,
  Effect.promise(() => connectToDb())
);
```

---

## Summary

| Concept            | Purpose                            |
| ------------------ | ---------------------------------- |
| `Context.Tag`      | Define service identifier          |
| `Effect.Service`   | Define service with built-in layer |
| `Layer`            | Blueprint for providing services   |
| `Effect.provide`   | Supply dependencies to effect      |
| `R` type parameter | Track dependencies at compile time |

The Context system enables:

- **Type-safe DI** - Compiler catches missing dependencies
- **Testability** - Swap implementations easily
- **Composability** - Build complex apps from simple services
- **Resource safety** - Scoped services with guaranteed cleanup
