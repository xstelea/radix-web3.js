import { PublicKey, RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit'

export const deriveAccountAddressFromPublicKey = (
  publicKey: PublicKey,
  networkId: number,
) =>
  RadixEngineToolkit.Derive.virtualAccountAddressFromPublicKey(
    publicKey,
    networkId,
  )
