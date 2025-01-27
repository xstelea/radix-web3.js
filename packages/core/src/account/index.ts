import { PublicKey, RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit'

const fromPublicKey = (publicKey: PublicKey, networkId: number) =>
  RadixEngineToolkit.Derive.virtualAccountAddressFromPublicKey(
    publicKey,
    networkId,
  )

export const account = {
  fromPublicKey,
}
