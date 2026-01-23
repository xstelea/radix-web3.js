# @radix-effects/transaction-stream

Stream transactions from the Radix network using [Effect](https://effect.website/).

## Installation

```bash
npm install @radix-effects/transaction-stream
```

## Usage

```typescript
import { Effect, Layer, Stream, Ref, Option, Duration } from 'effect';
import {
  TransactionStreamService,
  ConfigService,
  TransactionDetailsOptInsSchema,
} from '@radix-effects/transaction-stream';

const program = Effect.gen(function* () {
  // Create the transaction stream
  const stream = yield* TransactionStreamService.pipe(
    Effect.provide(TransactionStreamService.Default),
  );

  // Configure the stream
  const configRef = yield* ConfigService.make;
  yield* Ref.update(configRef, (config) => ({
    ...config,
    stateVersion: Option.some(1), // Start from state version 1
    limitPerPage: 100,
    waitTime: Duration.seconds(60),
    optIns: TransactionDetailsOptInsSchema.make({
      detailed_events: true,
      balance_changes: true,
    }),
  }));

  // Process transactions
  yield* Stream.runForEach(stream, (transactions) =>
    Effect.gen(function* () {
      for (const tx of transactions) {
        yield* Effect.log(`Processing tx: ${tx.intent_hash}`);
      }
    }),
  ).pipe(
    Effect.provide(Layer.effect(ConfigService, Effect.succeed(configRef))),
  );
});
```

## Configuration

The `ConfigService` allows you to configure the transaction stream:

| Option         | Type                        | Default             | Description                                   |
| -------------- | --------------------------- | ------------------- | --------------------------------------------- |
| `stateVersion` | `Option<number>`            | `Option.none()`     | Starting state version (none = current)       |
| `limitPerPage` | `number`                    | `100`               | Number of transactions per page               |
| `waitTime`     | `Duration`                  | `Duration.seconds(60)` | Wait time when no new transactions available |
| `optIns`       | `TransactionDetailsOptIns`  | See below           | Optional data to include in response          |

### Opt-ins

Control what data is included in the transaction response:

```typescript
TransactionDetailsOptInsSchema.make({
  raw_hex: false,                  // Raw transaction hex
  receipt_state_changes: false,    // State changes in receipt
  receipt_fee_summary: false,      // Fee summary in receipt
  receipt_fee_source: false,       // Fee source in receipt
  receipt_fee_destination: false,  // Fee destination in receipt
  receipt_costing_parameters: false, // Costing parameters in receipt
  receipt_events: false,           // Events in receipt (deprecated)
  detailed_events: false,          // Detailed events object
  receipt_output: true,            // Transaction receipt output
  affected_global_entities: false, // Affected global entities
  manifest_instructions: false,    // Manifest instructions
  balance_changes: false,          // Fungible/non-fungible balance changes
});
```

## Multiple Networks

You can run multiple streams for different networks simultaneously:

```typescript
import { ConfigProvider, Fiber } from 'effect';

const program = Effect.gen(function* () {
  // Configure for Stokenet (network ID 2)
  const stokenetConfig = Layer.setConfigProvider(
    ConfigProvider.fromJson({ NETWORK_ID: '2' }),
  );

  const stokenetStream = yield* TransactionStreamService.pipe(
    Effect.provide(TransactionStreamService.Default),
    Effect.provide(stokenetConfig),
  );

  // Mainnet uses default config (network ID 1)
  const mainnetStream = yield* TransactionStreamService.pipe(
    Effect.provide(TransactionStreamService.Default),
  );

  // Run both streams concurrently
  const stokenetFiber = yield* Effect.fork(
    Stream.runForEach(stokenetStream, processTransactions).pipe(
      Effect.provide(Layer.effect(ConfigService, Effect.succeed(stokenetConfigRef))),
    ),
  );

  const mainnetFiber = yield* Effect.fork(
    Stream.runForEach(mainnetStream, processTransactions).pipe(
      Effect.provide(Layer.effect(ConfigService, Effect.succeed(mainnetConfigRef))),
    ),
  );

  yield* Fiber.joinAll([stokenetFiber, mainnetFiber]);
});
```

## License

MIT
