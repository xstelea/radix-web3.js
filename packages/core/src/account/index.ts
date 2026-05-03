import {
  type PublicKey,
  RadixEngineToolkit,
} from '@steleaio/radix-engine-toolkit';

export const deriveAccountAddressFromPublicKey = (
  publicKey: PublicKey,
  networkId: number,
) =>
  RadixEngineToolkit.Derive.virtualAccountAddressFromPublicKey(
    publicKey,
    networkId,
  );
