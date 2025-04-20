import {
  TransactionHeader as TransactionHeaderType,
  PublicKey,
  generateRandomNonce,
} from '@radixdlt/radix-engine-toolkit'
import { RadixNetworkClient } from '../network'

export const createTransactionHeader = (
  notaryPublicKey: PublicKey,
  options?: Partial<{
    tipPercentage?: number
    nonce?: number
    notaryIsSignatory?: boolean
    epochBounds?: (currentEpoch: number) => {
      startEpochInclusive: number
      endEpochExclusive: number
    }
  }>,
) => {
  const {
    tipPercentage = 0,
    nonce = generateRandomNonce(),
    notaryIsSignatory = true,
    epochBounds = (currentEpoch: number) => ({
      startEpochInclusive: currentEpoch,
      endEpochExclusive: currentEpoch + 2,
    }),
  } = options || {}

  return async ({
    getCurrentEpoch,
    networkId,
  }: RadixNetworkClient): Promise<TransactionHeaderType> => {
    return getCurrentEpoch()
      .then(epochBounds)
      .then(({ startEpochInclusive, endEpochExclusive }) => ({
        networkId,
        startEpochInclusive,
        endEpochExclusive,
        nonce,
        notaryPublicKey,
        notaryIsSignatory,
        tipPercentage,
      }))
  }
}
