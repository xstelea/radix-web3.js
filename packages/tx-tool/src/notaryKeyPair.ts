import type { HexString } from '@radix-effects/shared';
import { Signature } from '@steleaio/radix-engine-toolkit';
import { Array as A, Context, Effect, flow, Layer, Option } from 'effect';

import { Signer } from './signer/signer';

export class NotaryKeyPair extends Context.Service<NotaryKeyPair>()(
  '@radix-effects/tx-tool/NotaryKeyPair',
  {
    make: Effect.gen(function* () {
      const signer = yield* Signer;

      return {
        publicKey: () => signer.publicKey(),
        signToSignature: (hash: HexString) =>
          signer.signToSignatureWithPublicKey(hash).pipe(
            Effect.map(
              flow(
                A.head,
                Option.map(
                  (signature) => new Signature.Ed25519(signature.signature),
                ),
                Option.getOrThrow,
              ),
            ),
          ),
      };
    }),
  },
) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies;
}
