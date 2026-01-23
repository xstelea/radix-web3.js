import type { Ed25519KeyPair } from '../../../crypto/ed25519';
import { decrypt } from '../../../crypto/encryption';
import { fromHex } from '../../../crypto/helpers/fromHex';
import { transformToSealbox } from '../../../crypto/sealbox';
import type { WalletInteractionResponse } from '../../../schemas/walletInteraction';

export const decryptPayload = async ({
  encryptedData,
  keyPair,
  salt,
  publicKey,
}: {
  encryptedData: string;
  keyPair: Ed25519KeyPair;
  salt: string;
  publicKey: string;
}): Promise<WalletInteractionResponse> => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const sharedSecret = keyPair.x25519.calculateSharedSecret({
    publicKey,
    salt: encoder.encode(salt),
    context: 'RCfM',
    length: 32,
  });

  const { iv, cipherTextAndAuthTag } = transformToSealbox(
    fromHex(encryptedData),
  );

  const decrypted = await decrypt({
    data: cipherTextAndAuthTag,
    encryptionKey: sharedSecret,
    iv,
  });

  const decryptedRaw = decoder.decode(decrypted);

  const walletInteractionResponse: WalletInteractionResponse =
    JSON.parse(decryptedRaw);

  return walletInteractionResponse;
};
