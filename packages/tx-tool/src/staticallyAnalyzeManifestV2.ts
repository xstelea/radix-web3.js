import { RadixEngineToolkit } from '@steleaio/radix-engine-toolkit';

import { Data, Effect } from 'effect';
import type { TransactionIntentV2 } from './schemas';

export class FailedToStaticallyAnalyzeManifestV2Error extends Data.TaggedError(
  'FailedToStaticallyAnalyzeManifestV2Error',
)<{
  error: unknown;
}> {}

export class StaticallyAnalyzeManifestV2 extends Effect.Service<StaticallyAnalyzeManifestV2>()(
  '@radix-effects/tx-tool/StaticallyAnalyzeManifestV2',
  {
    effect: Effect.gen(function* () {
      return (input: { intent: TransactionIntentV2 }) =>
        Effect.tryPromise({
          try: () =>
            RadixEngineToolkit.TransactionIntentV2.staticallyAnalyze(
              input.intent,
            ),
          catch: (error) =>
            new FailedToStaticallyAnalyzeManifestV2Error({ error }),
        });
    }),
  },
) {}
