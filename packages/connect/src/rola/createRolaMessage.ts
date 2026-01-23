import { concatBytes } from '@noble/hashes/utils';
import { fromHex } from '../crypto';
import { blake2b } from '../crypto/blake2b';

export const createRolaMessage = ({
  dAppDefinitionAddress,
  origin,
  challenge,
}: {
  dAppDefinitionAddress: string;
  origin: string;
  challenge: string;
}) => {
  const encoder = new TextEncoder();

  return blake2b(
    concatBytes(
      encoder.encode('R'),
      fromHex(challenge),
      new Uint8Array([dAppDefinitionAddress.length]),
      encoder.encode(dAppDefinitionAddress),
      encoder.encode(origin),
    ),
  );
};
