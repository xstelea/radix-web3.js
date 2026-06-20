import type { NetworkId } from '@radix-effects/shared';
import { RadixEngineToolkit } from '@steleaio/radix-engine-toolkit';
import { Context, Data, Effect, Layer } from 'effect';

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

export class StaticallyValidateManifest extends Context.Service<StaticallyValidateManifest>()(
  '@radix-effects/tx-tool/StaticallyValidateManifest',
  {
    make: Effect.gen(function* () {
      return (input: { manifest: Manifest; networkId: NetworkId }) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: () =>
              RadixEngineToolkit.TransactionManifest.staticallyValidate(
                input.manifest,
                input.networkId,
              ),
            catch: (error) => {
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
) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies;
}
