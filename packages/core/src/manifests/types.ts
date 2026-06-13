import type { TransactionManifest } from '@steleaio/radix-engine-toolkit';

import type { RadixNetworkClient } from '@/network';

export type ManifestHelper = {
  getKnownAddresses: RadixNetworkClient['getKnownAddresses'];
};

export type WithManifestHelper = (
  helpers: ManifestHelper,
) => Promise<TransactionManifest | string>;
