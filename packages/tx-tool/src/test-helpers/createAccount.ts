import { ed25519 } from '@noble/curves/ed25519.js';
import { hexToBytes } from '@noble/hashes/utils.js';
import { PrivateKey, RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit';
import { Effect } from 'effect';
import { AccountAddress } from '@radix-effects/shared/brandedTypes';

export const createAccount = (
  input?: Partial<{
    privateKey: Uint8Array;
    networkId: number;
  }>,
) =>
  Effect.gen(function* () {
    const privateKey = input?.privateKey
      ? input.privateKey
      : ed25519.keygen().secretKey;

    const publicKey = ed25519.getPublicKey(privateKey);
    const publicKeyHex = Buffer.from(publicKey).toString('hex');

    const keypair = new PrivateKey.Ed25519(privateKey);

    const address = yield* Effect.tryPromise(() =>
      RadixEngineToolkit.Derive.virtualAccountAddressFromPublicKey(
        keypair.publicKey(),
        input?.networkId ?? 1,
      ),
    );

    return {
      address: AccountAddress.make(address),
      sign: (hash: string) => {
        const signature = ed25519.sign(hexToBytes(hash), privateKey);
        return Buffer.from(signature).toString('hex');
      },
      publicKeyHex,
      privateKeyHex: Buffer.from(privateKey).toString('hex'),
    };
  });
