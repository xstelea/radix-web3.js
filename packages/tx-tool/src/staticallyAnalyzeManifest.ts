import type { NetworkId } from '@radix-effects/shared';
import { RadixEngineToolkit } from '@steleaio/radix-engine-toolkit';
import { Context, Data, Effect, Layer } from 'effect';

import type { Manifest } from './schemas';

export class FailedToStaticallyAnalyzeManifestError extends Data.TaggedError(
  'FailedToStaticallyAnalyzeManifestError',
)<{
  error: unknown;
}> {}

export class StaticallyAnalyzeManifest extends Context.Service<StaticallyAnalyzeManifest>()(
  '@radix-effects/tx-tool/StaticallyAnalyzeManifest',
  {
    make: Effect.gen(function* () {
      return (input: { manifest: Manifest; networkId: NetworkId }) =>
        Effect.tryPromise({
          try: () =>
            RadixEngineToolkit.TransactionManifest.staticallyAnalyze(
              input.manifest,
              input.networkId,
            ),
          catch: (error) =>
            new FailedToStaticallyAnalyzeManifestError({ error }),
        });
    }),
  },
) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies;
}
