import type { Ed25519KeyPair } from '../../../crypto/ed25519';
import { toHex } from '../../../crypto/helpers/toHex';
import { createMessageHash } from './createMessageHash';

export const produceSignature = (
  input: {
    interactionId: string;
    origin: string;
    dAppDefinitionAddress: string;
  },
  keyPair: Ed25519KeyPair,
) => {
  const hash = createMessageHash(input);
  const signature = keyPair.ed25519.sign(hash);

  return toHex(signature);
};
