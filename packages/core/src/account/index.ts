import { PublicKey, RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit'

export const fromPublicKey = (publicKey: PublicKey, networkId: number) =>
  RadixEngineToolkit.Derive.virtualAccountAddressFromPublicKey(
    publicKey,
    networkId,
  )
