import {
  Effect,
  Layer,
  Logger,
  ManagedRuntime,
  Option,
  pipe,
  Stream,
  Array as A,
  Duration,
  Context,
  Ref,
  Schema,
  Fiber,
  ConfigProvider,
} from 'effect';
import { TransactionStreamService } from '../src/streamer';
import { ConfigService } from '../src/config';
import { TransactionDetailsOptInsSchema } from '../src/schemas';
import { ScryptoSborValueSchema } from '@radix-effects/gateway';

const runtime = ManagedRuntime.make(Layer.mergeAll(Logger.pretty));

const runnable = Effect.gen(function* () {
  const stokenetConfig = Layer.setConfigProvider(
    ConfigProvider.fromJson({ NETWORK_ID: '2' }),
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
      optIns: TransactionDetailsOptInsSchema.make({
        detailed_events: true,
      }),
    };
  });

  const stokenetStreamFiber = yield* Effect.fork(
    Stream.runForEach(stokenetStream, (res) =>
      Effect.gen(function* () {
        // yield* Effect.log(res);
        // yield* Effect.sleep(Duration.seconds(60));
      }),
    ).pipe(
      Effect.provide(
        Layer.effect(ConfigService, Effect.succeed(stokenetConfigRef)),
      ),
      Effect.annotateLogs('network', 'stokenet'),
    ),
  );

  const mainnetStreamFiber = yield* Effect.fork(
    Stream.runForEach(
      mainnetStream.pipe(
        Stream.map((tx) =>
          tx.filter((item) => item.transaction_status === 'CommittedSuccess'),
        ),
      ),
      (res) =>
        Effect.gen(function* () {
          yield* Effect.forEach(res, (tx) =>
            Effect.gen(function* () {
              const detailedEvents = yield* pipe(
                Option.fromNullable(tx.receipt),
                Option.flatMap((receipt) =>
                  Option.fromNullable(receipt.detailed_events),
                ),
                Option.match({
                  onNone: () => Effect.succeed<ScryptoSborValueSchema[]>([]),
                  onSome: (events) =>
                    Effect.forEach(events, (event) =>
                      Schema.decodeUnknown(ScryptoSborValueSchema)(
                        event.payload.programmatic_json,
                      ).pipe(
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
    ).pipe(
      Effect.provide(
        Layer.effect(ConfigService, Effect.succeed(mainnetConfigRef)),
      ),
      Effect.annotateLogs('network', 'mainnet'),
    ),
  );

  yield* Fiber.joinAll([stokenetStreamFiber, mainnetStreamFiber]);
}).pipe(Effect.tapError(Effect.logError));

runtime.runPromiseExit(runnable);
