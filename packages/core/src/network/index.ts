import {
  FungibleResourcesCollectionItem,
  GatewayApiClient,
  NonFungibleResourcesCollectionItem,
  StateEntityFungiblesPageRequest,
  StateEntityFungiblesPageResponse,
  StateEntityNonFungiblesPageRequest,
  StateEntityNonFungiblesPageResponse,
} from '@radixdlt/babylon-gateway-api-sdk'
import { submitTransactionFactory } from './submitTransaction'
import { pollTransactionStatusFactory } from './pollTransactionStatus'
import {
  Intent,
  PublicKey,
  RadixEngineToolkit,
} from '@radixdlt/radix-engine-toolkit'
import { previewTransactionFactory } from './previewTransaction'

export type RadixNetworkClient = ReturnType<typeof createRadixNetworkClient>
export const createRadixNetworkClient = (input: {
  gatewayApiClient?: GatewayApiClient
  networkId: number
}) => {
  const gatewayApiClient =
    input.gatewayApiClient ??
    GatewayApiClient.initialize({
      networkId: input.networkId,
      applicationName: 'radix-web3.js',
    })

  const pollTransactionStatus = pollTransactionStatusFactory(gatewayApiClient)

  const getTransactionStatus = (transactionId: string) =>
    gatewayApiClient.transaction.getStatus(transactionId)

  const submitTransaction = async (input: Uint8Array) =>
    submitTransactionFactory(gatewayApiClient)(input)

  const getCurrentEpoch = () =>
    gatewayApiClient.status.getCurrent().then((res) => res.ledger_state.epoch)

  const getCurrentStateVersion = () =>
    gatewayApiClient.status
      .getCurrent()
      .then((status) => status.ledger_state.state_version)

  const getKnownAddresses = () =>
    RadixEngineToolkit.Utils.knownAddresses(input.networkId)

  const previewTransaction = previewTransactionFactory({
    networkId: input.networkId,
    gatewayApiClient,
  })

  const estimateTransactionFee = ({
    intent,
    signerPublicKeys,
    blobsHex,
  }: {
    intent: Intent
    signerPublicKeys: PublicKey[]
    blobsHex?: string[]
  }) =>
    previewTransaction({ intent, signerPublicKeys, blobsHex }).then(
      (previewReceipt) => {
        if (previewReceipt.receipt.status !== 'Succeeded') {
          return Promise.reject({
            code: 'TransactionPreviewError',
            message: 'Transaction preview failed',
          })
        }

        // Calculate the total fees
        const totalFees = [
          previewReceipt.receipt.fee_summary.xrd_total_execution_cost,
          previewReceipt.receipt.fee_summary.xrd_total_finalization_cost,
          previewReceipt.receipt.fee_summary.xrd_total_royalty_cost,
          previewReceipt.receipt.fee_summary.xrd_total_storage_cost,
          previewReceipt.receipt.fee_summary.xrd_total_tipping_cost,
        ]
          .map(parseFloat)
          .reduce((acc, item) => acc + item, 0)

        // We need to add another 10% to the fees as the preview response does not include everything needed
        // to actually submit the transaction, ie: signature validation
        const totalFeesPlus10Percent = totalFees * 1.1

        return totalFeesPlus10Percent
      },
    )

  const convertResourcesToBalances = (
    resources:
      | FungibleResourcesCollectionItem[]
      | NonFungibleResourcesCollectionItem[],
  ) =>
    resources
      .map((item) => {
        if (item.aggregation_level === 'Global')
          return {
            resourceAddress: item.resource_address,
            amount: `${item.amount}`,
          }
      })
      .filter((item) => item?.amount !== '0')

  const getFungibleTokens = async (
    address: string,
  ): Promise<FungibleResourcesCollectionItem[]> => {
    let hasNextPage = true
    let nextCursor = undefined
    let fungibleResources: FungibleResourcesCollectionItem[] = []
    const stateVersion = await getCurrentStateVersion()
    while (hasNextPage) {
      const stateEntityFungiblesPageRequest: StateEntityFungiblesPageRequest = {
        address: address,
        limit_per_page: 100,
        cursor: nextCursor,
        at_ledger_state: {
          state_version: stateVersion,
        },
      }

      const stateEntityFungiblesPageResponse: StateEntityFungiblesPageResponse =
        await gatewayApiClient.state.innerClient.entityFungiblesPage({
          stateEntityFungiblesPageRequest: stateEntityFungiblesPageRequest,
        })

      fungibleResources = fungibleResources.concat(
        stateEntityFungiblesPageResponse.items,
      )
      if (stateEntityFungiblesPageResponse.next_cursor) {
        nextCursor = stateEntityFungiblesPageResponse.next_cursor
      } else {
        hasNextPage = false
      }
    }
    return fungibleResources
  }

  const getNonFungibleTokens = async (
    address: string,
  ): Promise<NonFungibleResourcesCollectionItem[]> => {
    let hasNextPage = true
    let nextCursor = undefined
    const stateVersion = await getCurrentStateVersion()
    let nonFungibleResources: NonFungibleResourcesCollectionItem[] = []

    while (hasNextPage) {
      const stateEntityNonFungiblesPageRequest: StateEntityNonFungiblesPageRequest =
        {
          address: address,
          limit_per_page: 5,
          cursor: nextCursor,
          at_ledger_state: {
            state_version: stateVersion,
          },
        }

      const stateEntityNonFungiblesPageResponse: StateEntityNonFungiblesPageResponse =
        await gatewayApiClient.state.innerClient.entityNonFungiblesPage({
          stateEntityNonFungiblesPageRequest:
            stateEntityNonFungiblesPageRequest,
        })
      nonFungibleResources = nonFungibleResources.concat(
        stateEntityNonFungiblesPageResponse.items,
      )
      if (stateEntityNonFungiblesPageResponse.next_cursor) {
        nextCursor = stateEntityNonFungiblesPageResponse.next_cursor
      } else {
        hasNextPage = false
      }
    }
    return nonFungibleResources
  }

  return {
    networkId: input.networkId,
    submitTransaction,
    pollTransactionStatus,
    getTransactionStatus,
    getCurrentEpoch,
    getKnownAddresses,
    previewTransaction,
    estimateTransactionFee,
    getFungibleTokens: (address: string) =>
      getFungibleTokens(address).then(convertResourcesToBalances),
    getNonFungibleTokens: (address: string) =>
      getNonFungibleTokens(address).then(convertResourcesToBalances),
    gatewayApiClient,
  }
}
