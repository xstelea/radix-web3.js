import { RadixEngineToolkit } from '@steleaio/radix-engine-toolkit';
import { Context, Data, Effect, Layer } from 'effect';

import type { TransactionIntentV2 } from './schemas';

export class FailedToStaticallyAnalyzeManifestV2Error extends Data.TaggedError(
  'FailedToStaticallyAnalyzeManifestV2Error',
)<{
  error: unknown;
}> {}

export class StaticallyAnalyzeManifestV2 extends Context.Service<StaticallyAnalyzeManifestV2>()(
  '@radix-effects/tx-tool/StaticallyAnalyzeManifestV2',
  {
    make: Effect.gen(function* () {
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
) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies;
}
