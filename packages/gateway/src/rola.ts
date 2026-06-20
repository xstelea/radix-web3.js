import { Rola as RolaSdk, type RolaError } from '@radixdlt/rola';
import { Config, Context, Data, Effect, Layer, Schema } from 'effect';

import { GatewayApiClient } from './gatewayApiClient';

export class VerifyRolaProofError extends Data.TaggedError(
  'VerifyRolaProofError',
)<{
  error: RolaError;
}> {}

export const ProofSchema = Schema.Struct({
  publicKey: Schema.String,
  signature: Schema.String,
  curve: Schema.Union([
    Schema.Literal('curve25519'),
    Schema.Literal('secp256k1'),
  ]),
});

export const PersonaProofSchema = Schema.Struct({
  address: Schema.String,
  type: Schema.Literal('persona'),
  challenge: Schema.String,
  proof: ProofSchema,
});

export const AccountProofSchema = Schema.Struct({
  address: Schema.String,
  type: Schema.Literal('account'),
  challenge: Schema.String,
  proof: ProofSchema,
});

export const RolaProofSchema = Schema.Union([
  PersonaProofSchema,
  AccountProofSchema,
]);

export type PersonaProof = typeof PersonaProofSchema.Type;
export type AccountProof = typeof AccountProofSchema.Type;
export type RolaProof = typeof RolaProofSchema.Type;

export class Rola extends Context.Service<Rola>()('Rola', {
  make: Effect.gen(function* () {
    const applicationName = yield* Config.string('APPLICATION_NAME')
      .pipe(Config.withDefault('@radix-effects/gateway'))
      .pipe(Effect.orDie);
    const dAppDefinitionAddress = yield* Config.string(
      'DAPP_DEFINITION_ADDRESS',
    ).pipe(Effect.orDie);

    const expectedOrigin = yield* Config.string('ROLA_EXPECTED_ORIGIN').pipe(
      Effect.orDie,
    );

    const gatewayApiClient = yield* GatewayApiClient;

    const { verifySignedChallenge } = RolaSdk({
      networkId: gatewayApiClient.networkId,
      applicationName,
      dAppDefinitionAddress,
      expectedOrigin,
      gatewayApiClient: gatewayApiClient.rawClient,
    });

    return {
      verifySignedChallenge: (input: RolaProof) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise(() =>
            verifySignedChallenge(input),
          ).pipe(Effect.catchTag('UnknownError', Effect.orDie));

          if (result.isErr())
            return yield* new VerifyRolaProofError({
              error: result.error,
            });
        }),
    };
  }),
}) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(GatewayApiClient.Default),
  );
}
