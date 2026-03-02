import { HexString, TransactionId } from '@radix-effects/shared';
import { Convert, RadixEngineToolkit } from '@steleaio/radix-engine-toolkit';
import { Data, Effect, pipe } from 'effect';
import type { TransactionIntent, TransactionIntentV2 } from './schemas';

export class FailedToCreateIntentHashError extends Data.TaggedError(
  'FailedToCreateIntentHashError',
)<{
  error: unknown;
}> {}

export class IntentHashService extends Effect.Service<IntentHashService>()(
  '@radix-effects/tx-tool/IntentHashService',
  {
    effect: Effect.gen(function* () {
      const createIntentHash = (
        input: TransactionIntent | TransactionIntentV2,
      ) =>
        Effect.tryPromise({
          try: () =>
            'transactionHeader' in input
              ? RadixEngineToolkit.TransactionIntentV2.hash(input)
              : RadixEngineToolkit.Intent.hash(input),
          catch: (error) => new FailedToCreateIntentHashError({ error }),
        }).pipe(
          Effect.map((hash) => ({
            id: TransactionId.make(hash.id),
            hash: pipe(
              Convert.Uint8Array.toHexString(hash.hash),
              HexString.make,
            ),
          })),
        );

      return { create: createIntentHash };
    }),
  },
) {}
