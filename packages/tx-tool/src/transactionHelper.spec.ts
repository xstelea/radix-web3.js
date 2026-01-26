import { it } from '@effect/vitest';
import { GatewayApiClient } from '@radix-effects/gateway';
import {
  Cause,
  ConfigProvider,
  Effect,
  Exit,
  Layer,
  Logger,
  Redacted,
} from 'effect';
import { HexString } from '@radix-effects/shared';
import { Signer } from './signer/signer';
import { createAccount } from './test-helpers/createAccount';
import {
  TransactionHelper,
  TransactionLifeCycleHook,
} from './transactionHelper';

const signer = Signer.makePrivateKeySigner(
  Redacted.make(
    HexString.make(
      'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    ),
  ),
);

const GatewayApiClientLayer = GatewayApiClient.Default.pipe(
  Layer.provide(
    Layer.setConfigProvider(ConfigProvider.fromJson({ NETWORK_ID: 2 })),
  ),
);

const TestLayer = TransactionHelper.Default.pipe(
  Layer.provide(GatewayApiClientLayer),
  Layer.provide(signer),
  Layer.provide(Logger.pretty),
);

describe('TransactionHelper', () => {
  it.live(
    'should submit a transaction',
    () =>
      Effect.gen(function* () {
        const transactionHelper = yield* TransactionHelper;
        const account = yield* createAccount({ networkId: 2 });

        const transaction = yield* transactionHelper.faucet({
          account: {
            address: account.address,
            type: 'unsecurifiedAccount',
          },
        });

        expect(transaction).toBeDefined();
      }).pipe(Effect.provide(TestLayer)),
    { timeout: 30_000 },
  );

  it.live('should fail to submit a transaction if life cycle hook fails', () =>
    Effect.gen(function* () {
      const transactionHelper = yield* TransactionHelper;
      const account = yield* createAccount({ networkId: 2 });

      const exit = yield* transactionHelper
        .faucet({
          account: {
            address: account.address,
            type: 'unsecurifiedAccount',
          },
        })
        .pipe(Effect.exit);

      yield* Exit.match(exit, {
        onSuccess: () => Effect.die('expected failure'),
        onFailure: (cause) => Effect.succeed(Cause.isDie(cause)),
      });
    }).pipe(
      Effect.provide(TestLayer),
      Effect.provideService(TransactionLifeCycleHook, {
        onSubmit: Effect.die,
      }),
    ),
  );
});
