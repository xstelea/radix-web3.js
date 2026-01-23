import type { RadixNetworkClient } from '@/network';
import type { TransactionManifest } from '@radixdlt/radix-engine-toolkit';

export type ManifestHelper = {
  getKnownAddresses: RadixNetworkClient['getKnownAddresses'];
};

export type WithManifestHelper = (
  helpers: ManifestHelper,
) => Promise<TransactionManifest | string>;
