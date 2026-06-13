import type { NetworkId } from '@radix-effects/shared';
import { RadixEngineToolkit } from '@steleaio/radix-engine-toolkit';
import { Data, Effect } from 'effect';

import type { Manifest } from './schemas';

export class FailedToStaticallyAnalyzeManifestError extends Data.TaggedError(
  'FailedToStaticallyAnalyzeManifestError',
)<{
  error: unknown;
}> {}

export class StaticallyAnalyzeManifest extends Effect.Service<StaticallyAnalyzeManifest>()(
  '@radix-effects/tx-tool/StaticallyAnalyzeManifest',
  {
    effect: Effect.gen(function* () {
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
) {}
