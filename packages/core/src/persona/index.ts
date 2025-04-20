import { PublicKey, RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit'

export const deriveIdentityAddressFromPublicKey = (
  publicKey: PublicKey,
  networkId: number,
) =>
  RadixEngineToolkit.Derive.virtualIdentityAddressFromPublicKey(
    publicKey,
    networkId,
  )
