import { ScryptoSborValueSchema } from '@radix-effects/gateway';
import {
  ConfigProvider,
  Duration,
  Effect,
  Fiber,
  Layer,
  Logger,
  ManagedRuntime,
  Option,
  pipe,
  Ref,
  Schema,
  Stream,
} from 'effect';

import { ConfigService } from '../src/config';
import { makeTransactionDetailsOptIns } from '../src/schemas';
import { TransactionStreamService } from '../src/streamer';

const decodeSborValue = (value: unknown) =>
  Effect.try({
    try: () => Schema.decodeUnknownSync(ScryptoSborValueSchema)(value),
    catch: (error) => error,
  });

const runtime = ManagedRuntime.make(
  Layer.mergeAll(Logger.layer([Logger.consolePretty()])),
);

const runnable = Effect.gen(function* () {
  const stokenetConfig = ConfigProvider.layer(
    ConfigProvider.fromUnknown({ NETWORK_ID: '2' }),
  );

  const stokenetStream = yield* TransactionStreamService.pipe(
    Effect.provide(TransactionStreamService.Default),
    Effect.provide(stokenetConfig),
  );

  const mainnetStream = yield* TransactionStreamService.pipe(
    Effect.provide(TransactionStreamService.Default),
  );

  const stokenetConfigRef = yield* ConfigService.make;
  yield* Ref.update(stokenetConfigRef, (config) => {
    return {
      ...config,
      stateVersion: Option.none(),
      limitPerPage: 100,
      waitTime: Duration.seconds(60),
    };
  });

  const mainnetConfigRef = yield* ConfigService.make;
  yield* Ref.update(mainnetConfigRef, (config) => {
    return {
      ...config,
      stateVersion: Option.some(1),
      limitPerPage: 100,
      waitTime: Duration.seconds(60),
      optIns: makeTransactionDetailsOptIns({
        detailed_events: true,
      }),
    };
  });

  const stokenetStreamFiber = yield* stokenetStream
    .pipe(Stream.provideService(ConfigService, stokenetConfigRef))
    .pipe(
      Stream.runForEach((_res) =>
        Effect.gen(function* () {
          // yield* Effect.log(res);
          // yield* Effect.sleep(Duration.seconds(60));
        }),
      ),
      Effect.annotateLogs('network', 'stokenet'),
      Effect.forkChild,
    );

  const mainnetStreamFiber = yield* mainnetStream
    .pipe(Stream.provideService(ConfigService, mainnetConfigRef))
    .pipe(
      Stream.map((tx) =>
        tx.filter((item) => item.transaction_status === 'CommittedSuccess'),
      ),
      Stream.runForEach((res) =>
        Effect.gen(function* () {
          yield* Effect.forEach(res, (tx) =>
            Effect.gen(function* () {
              yield* pipe(
                Option.fromNullishOr(tx.receipt),
                Option.flatMap((receipt) =>
                  Option.fromNullishOr(receipt.detailed_events),
                ),
                Option.match({
                  onNone: () => Effect.succeed<ScryptoSborValueSchema[]>([]),
                  onSome: (events) =>
                    Effect.forEach(events, (event) =>
                      decodeSborValue(event.payload.programmatic_json).pipe(
                        Effect.tap((item) =>
                          Effect.log(
                            JSON.stringify(
                              {
                                raw: event.payload.programmatic_json,
                                parsed: item,
                              },
                              null,
                              2,
                            ),
                          ),
                        ),
                        Effect.tapError((error) => {
                          return Effect.logError(
                            JSON.stringify(
                              {
                                message: 'Failed to decode Sbor value',
                                error,
                                sbor: event.payload.programmatic_json,
                              },
                              null,
                              2,
                            ),
                          );
                        }),
                      ),
                    ),
                }),
              );
              // yield* Effect.log(JSON.stringify(detailedEvents, null, 2));
            }).pipe(Effect.annotateLogs('tx', tx.intent_hash)),
          );

          yield* Effect.sleep(Duration.seconds(10));
        }),
      ),
      Effect.annotateLogs('network', 'mainnet'),
      Effect.forkChild,
    );

  yield* Fiber.joinAll([stokenetStreamFiber, mainnetStreamFiber]);
}).pipe(Effect.tapError((error) => Effect.logError(error)));

runtime.runPromiseExit(runnable);
