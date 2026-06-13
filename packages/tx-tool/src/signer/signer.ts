import type { HexString } from '@radix-effects/shared';
import { Convert, type PublicKey } from '@steleaio/radix-engine-toolkit';
import { Context, Data, Effect, Layer, Redacted, Schema } from 'effect';

import {
  Ed25519PrivateKeySchema,
  type Ed25519SignatureWithPublicKey,
} from '../schemas';

export class FailedToSignTransactionError extends Data.TaggedError(
  '@radix-effects/tx-tool/FailedToSignTransactionError',
)<{
  error: unknown;
}> {}

export class Signer extends Context.Tag('Signer')<
  Signer,
  {
    signToSignatureWithPublicKey: (
      hash: HexString,
    ) => Effect.Effect<
      Ed25519SignatureWithPublicKey[],
      FailedToSignTransactionError,
      never
    >;
    publicKey: () => Effect.Effect<PublicKey, never, never>;
  }
>() {
  static makePrivateKeySigner = (privateKey: Redacted.Redacted<HexString>) =>
    Layer.effect(
      Signer,
      Effect.gen(function* () {
        return {
          signToSignatureWithPublicKey: (hash: HexString) =>
            Effect.gen(function* () {
              const value = Redacted.value(privateKey);
              const Ed25519PrivateKey = yield* Schema.decode(
                Ed25519PrivateKeySchema,
              )(value);
              const signatureWithPublicKey =
                Ed25519PrivateKey.signToSignatureWithPublicKey(
                  Convert.HexString.toUint8Array(hash),
                );

              return [
                {
                  curve: 'Ed25519' as const,
                  signature: signatureWithPublicKey.signature,
                  publicKey: Ed25519PrivateKey.publicKey().bytes,
                },
              ];
            }).pipe(
              Effect.orDie,
              Effect.annotateLogs({
                signer: 'PrivateKey',
              }),
            ),
          publicKey: () =>
            Effect.gen(function* () {
              const value = Redacted.value(privateKey);
              const Ed25519PrivateKey = yield* Schema.decode(
                Ed25519PrivateKeySchema,
              )(value);
              return Ed25519PrivateKey.publicKey();
            }).pipe(Effect.orDie),
        };
      }),
    );
}
