import { RadixNetworkClient } from '@/network'
import { TransactionManifest } from '@radixdlt/radix-engine-toolkit'

export type ManifestHelper = {
  getKnownAddresses: RadixNetworkClient['getKnownAddresses']
}

export type WithManifestHelper = (
  helpers: ManifestHelper,
) => Promise<TransactionManifest | string>
