# Effect Queue Module - Deep Analysis

## Overview

The `Queue` module in Effect is a **fiber-safe, asynchronous, bounded queue** for concurrent communication between fibers. It implements the classic producer/consumer pattern with configurable overflow strategies (backpressure, dropping, sliding).

Key properties:

- **Fiber-safe** — all operations are atomic; no locks needed
- **Backpressure-aware** — producers can suspend when queue is full
- **Shutdown-safe** — clean interruption of all waiting fibers
- **Dequeue is an Effect** — a `Dequeue<A>` _is_ an `Effect<A>`, so you can `yield*` a queue directly to take from it

**Source:** `.repos/effect/packages/effect/src/Queue.ts` (public API)
**Internal:** `.repos/effect/packages/effect/src/internal/queue.ts` (implementation)

---

## Core Types

### Type Hierarchy

```
Queue<A>  =  Enqueue<A>  &  Dequeue<A>
               ↑ offer         ↑ take
               ↑ offerAll      ↑ takeAll, takeUpTo, takeBetween
                               ↑ extends Effect<A>
```

### Queue\<A\>

The full read-write queue. Combines `Enqueue` and `Dequeue`.

```typescript
interface Queue<in out A> extends Enqueue<A>, Dequeue<A> {
  // Internal fields (not part of public API):
  readonly queue: BackingQueue<A>; // ring buffer / linked list
  readonly takers: MutableQueue<Deferred<A>>; // suspended consumers
  readonly shutdownHook: Deferred<void>; // one-shot shutdown signal
  readonly shutdownFlag: MutableRef<boolean>; // mutable shutdown flag
  readonly strategy: Strategy<A>; // overflow behavior
}
```

### Enqueue\<A\> — Write Side

```typescript
interface Enqueue<in A> extends BaseQueue, Pipeable {
  offer(value: A): Effect<boolean>;
  unsafeOffer(value: A): boolean;
  offerAll(iterable: Iterable<A>): Effect<boolean>;
}
```

Variance: **contravariant** in `A` (you can widen the accepted type).

### Dequeue\<A\> — Read Side

```typescript
interface Dequeue<out A> extends Effect<A>, BaseQueue {
  readonly take: Effect<A>;
  readonly takeAll: Effect<Chunk<A>>;
  takeUpTo(max: number): Effect<Chunk<A>>;
  takeBetween(min: number, max: number): Effect<Chunk<A>>;
}
```

Variance: **covariant** in `A` (you can narrow the output type).

**Critical:** `Dequeue<A> extends Effect<A>`. This means a queue itself can be yielded in `Effect.gen`:

```typescript
const program = Effect.gen(function* () {
  const queue = yield* Queue.bounded<number>(10);
  yield* queue.offer(42);
  const value = yield* queue; // Dequeue IS an Effect — takes oldest item
  //    value === 42
});
```

### BaseQueue — Shared Interface

```typescript
interface BaseQueue {
  capacity(): number;
  isActive(): boolean;
  readonly size: Effect<number>; // may be negative (see Size Semantics)
  unsafeSize(): Option<number>; // None if shutdown
  readonly isFull: Effect<boolean>;
  readonly isEmpty: Effect<boolean>;
  readonly shutdown: Effect<void>;
  readonly isShutdown: Effect<boolean>;
  readonly awaitShutdown: Effect<void>;
}
```

---

## Queue Variants

| Constructor         | Strategy     | On Full Queue (offer)                | On Full Queue (offerAll)             | Returns            |
| ------------------- | ------------ | ------------------------------------ | ------------------------------------ | ------------------ |
| `Queue.bounded(n)`  | BackPressure | **Suspends** fiber until space       | **Suspends** fiber until space       | `Effect<Queue<A>>` |
| `Queue.unbounded()` | Dropping\*   | Never full (`capacity = ∞`)          | Never full                           | `Effect<Queue<A>>` |
| `Queue.dropping(n)` | Dropping     | **Drops new** items, returns `false` | **Drops new** items, returns `false` | `Effect<Queue<A>>` |
| `Queue.sliding(n)`  | Sliding      | **Drops oldest** item, adds new      | **Drops oldest** items, adds new     | `Effect<Queue<A>>` |

_\*Unbounded uses `DroppingStrategy` internally, but since capacity is `Infinity`, surplus handling never triggers._

**Performance tip:** Use power-of-2 capacities (2, 4, 8, 16, ...) for bounded queues. The underlying `RingBuffer` is optimized for these sizes.

```typescript
// Creating queues
const bounded = yield * Queue.bounded<string>(64); // backpressure at 64
const unbounded = yield * Queue.unbounded<string>(); // no limit
const dropping = yield * Queue.dropping<number>(100); // drop new when full
const sliding = yield * Queue.sliding<number>(100); // drop oldest when full
```

---

## Strategy System

The `Strategy<A>` interface controls what happens when `offer` exceeds queue capacity.

```typescript
interface Strategy<in out A> {
  surplusSize(): number;
  readonly shutdown: Effect<void>;
  handleSurplus(
    iterable: Iterable<A>,
    queue: BackingQueue<A>,
    takers: MutableQueue<Deferred<A>>,
    isShutdown: MutableRef<boolean>
  ): Effect<boolean>;
  onCompleteTakersWithEmptyQueue(takers: MutableQueue<Deferred<A>>): void;
  unsafeOnQueueEmptySpace(
    queue: BackingQueue<A>,
    takers: MutableQueue<Deferred<A>>
  ): void;
}
```

### BackPressureStrategy

Used by `Queue.bounded`. The most complex strategy.

```
offer(value) when queue is full:
  1. Create Deferred<boolean> for the fiber
  2. Store [value, deferred, isLastItem] in internal putters queue
  3. Fiber suspends on deferred
  4. When a consumer takes → space freed → putter drained into queue → deferred completed
  5. If interrupted → cleanup removes deferred from putters
```

Internal state:

```typescript
// Each putter is a tagged tuple:
readonly putters: MutableQueue<readonly [A, Deferred<boolean>, boolean]>
//                                       ^  ^                  ^
//                                       |  |                  └─ true if last item in batch
//                                       |  └──────────────────── completes when value accepted
//                                       └─────────────────────── the value to enqueue
```

The `isLastItem` flag is an optimization: for `offerAll([a, b, c])`, only the _last_ item (`c`) has `isLastItem = true`. The deferred is completed once — when the last item is accepted — avoiding redundant fiber wake-ups.

**Zero-copy optimization:** When queue is empty and takers are waiting, `onCompleteTakersWithEmptyQueue` matches putters directly with takers — the value never touches the backing queue.

### DroppingStrategy

Used by `Queue.dropping` and `Queue.unbounded`.

```typescript
handleSurplus() → Effect.succeed(false)   // just drops, returns false
surplusSize()   → 0                        // no waiting putters
shutdown        → no-op                    // nothing to clean up
```

### SlidingStrategy

Used by `Queue.sliding`.

```typescript
handleSurplus(iterable, queue) → {
  for each value in iterable:
    queue.poll()          // remove oldest
    queue.offer(value)    // add new
  return true             // always succeeds
}
surplusSize() → 0          // no waiting putters
shutdown      → no-op
```

---

## Core Operations

### Offering (Write)

| Function            | Signature                             | Behavior                                                      |
| ------------------- | ------------------------------------- | ------------------------------------------------------------- |
| `Queue.offer`       | `(self, value) => Effect<boolean>`    | Place one value. May suspend (backpressure) or drop.          |
| `Queue.unsafeOffer` | `(self, value) => boolean`            | Synchronous offer. No suspension. Returns `false` if dropped. |
| `Queue.offerAll`    | `(self, iterable) => Effect<boolean>` | Batch offer. Strategy applies to surplus.                     |

**offer flow (internal):**

```
offer(value):
  if shutdown → interrupt
  if queue is empty AND takers waiting:
    → complete first taker directly with value (zero-copy)
    → return true
  else:
    → try queue.offer(value)
    → if succeeded → complete any waiting takers → return true
    → if failed   → delegate to strategy.handleSurplus
```

**offerAll flow (internal):**

```
offerAll(values):
  if shutdown → interrupt
  match N takers with first N values (zero-copy)
  offer remaining values to backing queue
  if surplus exists → delegate to strategy.handleSurplus
```

### Taking (Read)

| Function            | Signature                              | Behavior                                                                              |
| ------------------- | -------------------------------------- | ------------------------------------------------------------------------------------- |
| `Queue.take`        | `(self) => Effect<A>`                  | Take oldest. **Suspends** if empty.                                                   |
| `Queue.takeAll`     | `(self) => Effect<Chunk<A>>`           | Take everything. Returns empty chunk if empty. **Never suspends.**                    |
| `Queue.takeUpTo`    | `(self, max) => Effect<Chunk<A>>`      | Take up to `max`. **Never suspends.**                                                 |
| `Queue.takeBetween` | `(self, min, max) => Effect<Chunk<A>>` | Take between `min` and `max`. **Suspends** until `min` available.                     |
| `Queue.takeN`       | `(self, n) => Effect<Chunk<A>>`        | Take exactly `n`. **Suspends** until `n` available. Shortcut for `takeBetween(n, n)`. |
| `Queue.poll`        | `(self) => Effect<Option<A>>`          | Take one if available. **Never suspends.** Returns `None` if empty.                   |

**take flow (internal):**

```
take:
  if shutdown → interrupt
  item = queue.poll()
  if item exists:
    → strategy.unsafeOnQueueEmptySpace()    // drain putters if backpressure
    → return item
  else:
    → create Deferred<A>
    → add to takers queue
    → unsafeCompleteTakers()                // in case value arrived concurrently
    → if shutdown → interrupt
    → await deferred
    → on interrupt → remove deferred from takers (cleanup)
```

**takeBetween flow (internal):**

```
takeBetween(min, max):
  takeUpTo(max)                             // non-suspending batch
  if got >= min → return
  else → take one (suspending) → recurse with remaining min/max
```

---

## Backpressure & Suspension

### How Fibers Suspend

Effect queues use `Deferred` for fiber coordination — a one-shot promise that a fiber can await.

```
                    ┌─────────────┐
  Producer fiber    │ BackingQueue │    Consumer fiber
  ──────────────    │  [a][b][c]  │    ──────────────
                    └─────────────┘
  offer(d) when full:                  take when empty:
    1. Create Deferred<boolean>          1. Create Deferred<A>
    2. Add to putters queue              2. Add to takers queue
    3. Suspend on deferred               3. Suspend on deferred
       │                                    │
       ▼                                    ▼
    Wakes when consumer takes            Wakes when producer offers
    and space is freed                   or putter matched directly
```

### Taker-Putter Direct Matching

When the backing queue is empty and both takers and putters exist, the `BackPressureStrategy.onCompleteTakersWithEmptyQueue` method matches them directly:

```
putters queue:  [ [val₁, def₁, true], [val₂, def₂, true] ]
takers queue:   [ taker₁, taker₂ ]

→ complete taker₁ with val₁, complete def₁ with true
→ complete taker₂ with val₂, complete def₂ with true
→ values never enter the backing queue
```

### The unsafeCompleteTakers Loop

This is the core matching loop that runs after every offer/take:

```
while queue is not empty AND takers exist:
  poll a taker
  poll an item from queue
  if both exist → complete taker with item
                → strategy.unsafeOnQueueEmptySpace() (drain putters)
  if no item   → put taker back

if queue is empty AND takers still waiting:
  → strategy.onCompleteTakersWithEmptyQueue()  (direct putter→taker match)
```

---

## Shutdown Semantics

### Shutdown Flow

```
shutdown:
  1. Set shutdownFlag = true                          (atomic)
  2. Try to complete shutdownHook deferred             (idempotent)
  3. If first to shut down:
     a. Poll ALL takers → interrupt each one concurrently
     b. strategy.shutdown → interrupt all putters (BackPressure only)
  4. Entire operation is uninterruptible
```

### Post-Shutdown Behavior

| Operation                 | After Shutdown                          |
| ------------------------- | --------------------------------------- |
| `offer` / `offerAll`      | Returns `interrupt` (fiber interrupted) |
| `take` / `takeAll` / etc. | Returns `interrupt`                     |
| `unsafeOffer`             | Returns `false`                         |
| `unsafeSize`              | Returns `None`                          |
| `isActive()`              | Returns `false`                         |
| `isShutdown`              | Returns `true`                          |
| `awaitShutdown`           | Resumes immediately                     |
| `shutdown` (again)        | No-op (deferred already completed)      |

### awaitShutdown

Waits for the queue to shut down. If already shut down, resumes immediately. Useful for coordinating pipeline teardown:

```typescript
const pipeline = Effect.gen(function* () {
  const queue = yield* Queue.bounded<Job>(100);

  // Consumer
  yield* Effect.fork(
    Effect.gen(function* () {
      while (true) {
        const job = yield* queue.take;
        yield* processJob(job);
      }
    })
  );

  // Shutdown listener
  yield* Effect.fork(
    Effect.gen(function* () {
      yield* queue.awaitShutdown;
      yield* Effect.log("Queue shut down, cleaning up...");
    })
  );
});
```

---

## Size Semantics

The `size` property has unusual semantics — it can be **negative**.

```typescript
size = queue.length - takers.length + strategy.surplusSize;
//     ^              ^                ^
//     items stored   waiting          waiting putters
//     in buffer      consumers        (backpressure only)
```

| Size Value   | Meaning                             |
| ------------ | ----------------------------------- | ---- | -------------------------------------- |
| `size > 0`   | There are `size` items in the queue |
| `size === 0` | Queue is empty, no one waiting      |
| `size < 0`   | `                                   | size | ` fibers are suspended waiting to take |

```typescript
const queue = yield * Queue.bounded<number>(10);

// Nothing happening
yield * queue.size; // 0

// Add some items
yield * queue.offer(1);
yield * queue.offer(2);
yield * queue.size; // 2

// Fork consumers that wait
yield * Effect.fork(queue.take);
yield * Effect.fork(queue.take);
yield * Effect.fork(queue.take);
// After items consumed, one fiber still waiting:
yield * queue.size; // -1  (one suspended taker)
```

### unsafeSize

Returns `Option<number>`:

- `Some(n)` — current signed size
- `None` — queue has been shut down

---

## Patterns

### Producer / Consumer

```typescript
const producerConsumer = Effect.gen(function* () {
  const queue = yield* Queue.bounded<string>(100);

  // Producer
  const producer = yield* Effect.fork(
    Effect.gen(function* () {
      for (const item of items) {
        yield* queue.offer(item);
      }
      yield* queue.shutdown;
    })
  );

  // Consumer
  const consumer = yield* Effect.fork(
    Effect.gen(function* () {
      const results: string[] = [];
      while (true) {
        const item = yield* queue.take; // suspends until available
        results.push(item);
      }
    }).pipe(Effect.catchAllCause(() => Effect.void)) // handle shutdown interrupt
  );

  yield* Fiber.join(producer);
  yield* Fiber.join(consumer);
});
```

### Bounded Work Queue (Rate Limiting)

```typescript
const workQueue = Effect.gen(function* () {
  const queue = yield* Queue.bounded<Job>(10); // max 10 pending jobs

  // N workers
  yield* Effect.forEach(
    Array.from({ length: 4 }),
    () =>
      Effect.fork(
        Effect.forever(
          Effect.gen(function* () {
            const job = yield* queue.take;
            yield* processJob(job);
          })
        )
      ),
    { discard: true }
  );

  return queue; // return Enqueue side to producers
});
```

### Sliding Window (Latest N)

```typescript
// Keep only the latest 5 readings
const sensorQueue = yield * Queue.sliding<SensorReading>(5);

// Producer sends continuously — old readings auto-dropped
yield *
  Effect.fork(
    Effect.forever(
      Effect.gen(function* () {
        const reading = yield* readSensor();
        yield* sensorQueue.offer(reading);
        yield* Effect.sleep("100 millis");
      })
    )
  );

// Consumer gets latest batch
const latest = yield * sensorQueue.takeAll; // up to 5 most recent
```

### Fan-Out (Multiple Consumers)

```typescript
// Distribute work across consumers — each item goes to exactly one
const fanOut = Effect.gen(function* () {
  const queue = yield* Queue.bounded<Task>(256);

  // 8 consumer fibers all taking from same queue
  const workers = yield* Effect.forEach(Array.from({ length: 8 }), () =>
    Effect.fork(
      Effect.forever(
        Effect.gen(function* () {
          const task = yield* queue.take;
          yield* handleTask(task);
        })
      )
    )
  );

  return queue;
});
```

---

## Common Mistakes

### 1. Forgetting to Handle Shutdown Interrupts

When a queue shuts down, all suspended `take`/`offer` fibers are interrupted. If your consumer loop doesn't handle this, the interrupt propagates up.

```typescript
// Wrong — interrupt propagates and may crash parent
yield *
  Effect.fork(
    Effect.forever(
      Effect.gen(function* () {
        const item = yield* queue.take;
        yield* process(item);
      })
    )
  );

// Correct — catch the interrupt from shutdown
yield *
  Effect.fork(
    Effect.forever(
      Effect.gen(function* () {
        const item = yield* queue.take;
        yield* process(item);
      })
    ).pipe(Effect.catchAllCause(() => Effect.void))
  );
```

### 2. Unbounded Queue Memory Growth

`Queue.unbounded` has no backpressure. If producers are faster than consumers, memory grows without bound.

```typescript
// Dangerous — no backpressure
const queue = yield * Queue.unbounded<Event>();

// Safe — bounded with backpressure slows producers
const queue = yield * Queue.bounded<Event>(1000);

// Also safe — sliding drops oldest if overwhelmed
const queue = yield * Queue.sliding<Event>(1000);
```

### 3. Ignoring the offer Return Value

With `dropping` queues, `offer` returns `false` when the item was dropped. Ignoring this silently loses data.

```typescript
// Bug — silently drops items
yield * queue.offer(item);

// Correct — check return value
const accepted = yield * queue.offer(item);
if (!accepted) {
  yield * Effect.log("Item dropped — queue full");
}
```

### 4. Using unsafeOffer Without Checking Shutdown

`unsafeOffer` returns `false` both when the queue is full AND when it's shut down. You can't distinguish the two.

```typescript
// Ambiguous
const ok = queue.unsafeOffer(value); // false = full? or shutdown?

// Better — use the effectful offer which interrupts on shutdown
yield * queue.offer(value);
```

### 5. takeAll on Empty Queue Doesn't Suspend

Unlike `take`, `takeAll` returns immediately with an empty chunk if the queue is empty. This can create busy-wait loops.

```typescript
// Bug — spins CPU if queue is empty
yield *
  Effect.forever(
    Effect.gen(function* () {
      const items = yield* queue.takeAll; // returns Chunk.empty() immediately
      yield* processBatch(items);
    })
  );

// Correct — use take (suspends) or takeBetween (suspends until min met)
yield *
  Effect.forever(
    Effect.gen(function* () {
      const items = yield* queue.takeBetween(1, 100); // waits for at least 1
      yield* processBatch(items);
    })
  );
```

---

## Quick Reference

### Constructors

| Function                             | Description                                |
| ------------------------------------ | ------------------------------------------ |
| `Queue.bounded(capacity)`            | Bounded queue, backpressure on full        |
| `Queue.unbounded()`                  | Unbounded queue, no backpressure           |
| `Queue.dropping(capacity)`           | Bounded queue, drops new items on full     |
| `Queue.sliding(capacity)`            | Bounded queue, drops oldest items on full  |
| `Queue.make(backingQueue, strategy)` | Low-level: custom backing queue + strategy |

### Operations

| Function                            | Description                                  |
| ----------------------------------- | -------------------------------------------- |
| `Queue.offer(self, value)`          | Offer one value. May suspend (backpressure). |
| `Queue.unsafeOffer(self, value)`    | Synchronous offer. No suspension.            |
| `Queue.offerAll(self, iterable)`    | Offer batch. Strategy applies to surplus.    |
| `Queue.take(self)`                  | Take oldest. Suspends if empty.              |
| `Queue.takeAll(self)`               | Take all available. Never suspends.          |
| `Queue.takeUpTo(self, max)`         | Take up to N. Never suspends.                |
| `Queue.takeBetween(self, min, max)` | Take min..max. Suspends until min met.       |
| `Queue.takeN(self, n)`              | Take exactly N. Suspends until N available.  |
| `Queue.poll(self)`                  | Take one as `Option`. Never suspends.        |

### Queue State

| Function                    | Description                            |
| --------------------------- | -------------------------------------- |
| `Queue.capacity(self)`      | Max items the queue can hold           |
| `Queue.size(self)`          | Current size (may be negative)         |
| `Queue.isEmpty(self)`       | True if size <= 0                      |
| `Queue.isFull(self)`        | True if size >= capacity               |
| `Queue.isShutdown(self)`    | True if shutdown was called            |
| `Queue.awaitShutdown(self)` | Waits until queue is shut down         |
| `Queue.shutdown(self)`      | Shut down queue, interrupt all waiters |

### Refinements

| Function             | Description                       |
| -------------------- | --------------------------------- |
| `Queue.isQueue(u)`   | Type guard for `Queue<unknown>`   |
| `Queue.isEnqueue(u)` | Type guard for `Enqueue<unknown>` |
| `Queue.isDequeue(u)` | Type guard for `Dequeue<unknown>` |

### Strategies

| Function                       | Description                 |
| ------------------------------ | --------------------------- |
| `Queue.backPressureStrategy()` | Suspend producers when full |
| `Queue.droppingStrategy()`     | Drop new items when full    |
| `Queue.slidingStrategy()`      | Drop oldest items when full |
