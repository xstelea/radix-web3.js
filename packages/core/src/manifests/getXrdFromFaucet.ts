import {
  bucket,
  decimal,
  ManifestBuilder,
} from '@radixdlt/radix-engine-toolkit'
import { ManifestHelper } from './types'

export const getXrdFromFaucetManifest =
  (accountAddress: string) =>
  ({ getKnownAddresses }: ManifestHelper) =>
    getKnownAddresses().then((knownAddresses) =>
      new ManifestBuilder()
        .callMethod(knownAddresses.componentAddresses.faucet, 'lock_fee', [
          decimal(10),
        ])
        .callMethod(knownAddresses.componentAddresses.faucet, 'free', [])
        .takeAllFromWorktop(
          knownAddresses.resourceAddresses.xrd,
          (builder, bucketId) =>
            builder.callMethod(accountAddress, 'deposit', [bucket(bucketId)]),
        )
        .build(),
    )
