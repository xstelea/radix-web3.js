import { RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit'

export const getKnownAddresses = (networkId: number) =>
  RadixEngineToolkit.Utils.knownAddresses(networkId)
