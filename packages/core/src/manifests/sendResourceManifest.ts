import {
  address,
  bucket,
  decimal,
  enumeration,
  ManifestBuilder,
} from '@radixdlt/radix-engine-toolkit'

export const sendResourceManifest = ({
  resourceAddress,
  fromAddress,
  toAddress,
  amount,
  feeAmount = 10,
}: {
  resourceAddress: string
  fromAddress: string
  toAddress: string
  amount: string
  feeAmount?: number
}) =>
  new ManifestBuilder()
    .callMethod(fromAddress, 'lock_fee', [decimal(feeAmount)])
    .callMethod(fromAddress, 'withdraw', [
      address(resourceAddress),
      decimal(amount),
    ])
    .takeFromWorktop(
      resourceAddress,
      decimal(amount).value,
      (builder, bucketId) =>
        builder.callMethod(toAddress, 'try_deposit_or_abort', [
          bucket(bucketId),
          enumeration(0),
        ]),
    )
    .build()
