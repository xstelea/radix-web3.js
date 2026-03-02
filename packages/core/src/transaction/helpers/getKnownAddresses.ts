import { RadixEngineToolkit } from '@steleaio/radix-engine-toolkit';

export const getKnownAddresses = (networkId: number) =>
  RadixEngineToolkit.Utils.knownAddresses(networkId);
