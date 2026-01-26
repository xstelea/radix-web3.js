import { RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit';

import { Data, Effect } from 'effect';
import type { NetworkId } from '@radix-effects/shared';
import type { Manifest } from './schemas';

export class FailedToStaticallyValidateManifestError extends Data.TaggedError(
  'FailedToStaticallyValidateManifestError',
)<{
  error: unknown;
}> {}

export class InvalidManifestError extends Data.TaggedError(
  'InvalidManifestError',
)<{
  message: string;
}> {}

export class StaticallyValidateManifest extends Effect.Service<StaticallyValidateManifest>()(
  'StaticallyValidateManifest',
  {
    effect: Effect.gen(function* () {
      return (input: { manifest: Manifest; networkId: NetworkId }) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: () =>
              RadixEngineToolkit.TransactionManifest.staticallyValidate(
                input.manifest,
                input.networkId,
              ),
            catch: (error) => {
              console.error(error);
              return new FailedToStaticallyValidateManifestError({
                error,
              });
            },
          });
          if (result.kind === 'Invalid') {
            return yield* Effect.fail(
              new InvalidManifestError({
                message: result.error,
              }),
            );
          }
        });
    }),
  },
) {}
