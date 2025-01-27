import { WithManifestHelper } from '@/manifests/types'
import { createRadixNetworkClient } from '@/network'
import { RadixNetworkId } from '@/network/getRadixGatewayBaseUrl'
import { PollTransactionStatusOptions } from '@/network/pollTransactionStatus'
import {
  createTransactionHelper,
  TransactionNotarizer,
  TransactionSigner,
} from '@/transaction'
import { createTransactionHeader } from '@/transaction/transactionHeader'
import { createStringMessage } from '@/transaction/transactionMessage'
import { transformStringManifest } from '@/transaction/transformStringManifest'
import {
  GatewayApiClient,
  TransactionStatusResponse as TransactionStatusResponseType,
} from '@radixdlt/babylon-gateway-api-sdk'
import {
  Intent,
  Message,
  PublicKey,
  Signature,
  TransactionHeader,
  TransactionManifest,
} from '@radixdlt/radix-engine-toolkit'

export type Manifest = TransactionManifest | string | WithManifestHelper
export type TransactionStatusResponse = TransactionStatusResponseType

export type SubmitTransactionOptions = {
  transactionHeader?: TransactionHeader
  notaryPublicKey?: PublicKey
  message?: Message | string
  signer?: TransactionSigner
  notarizer?: TransactionNotarizer
  pollingOptions?: PollTransactionStatusOptions
}

export type CreateWeb3ClientOptions = {
  networkId?: keyof typeof RadixNetworkId
  gatewayApiClient?: GatewayApiClient
  notaryPublicKey?: PublicKey
  signer?: TransactionSigner
  notarizer?: TransactionNotarizer
  messageSigner?: (message: string) => Promise<Signature> | Signature
}

export type RadixWeb3Client = ReturnType<typeof createRadixWeb3Client>

export const createRadixWeb3Client = (options?: CreateWeb3ClientOptions) => {
  const {
    networkId = 'Mainnet',
    gatewayApiClient,
    notaryPublicKey: defaultNotaryPublicKey,
    signer: defaultSigner,
    notarizer: defaultNotarizer,
    messageSigner,
  } = options ?? {}

  const radixNetworkClient = createRadixNetworkClient({
    networkId: RadixNetworkId[networkId],
    gatewayApiClient,
  })

  const getDefaultNotaryPublicKey = () => {
    if (!defaultNotaryPublicKey) {
      throw new Error('Notary public key not provided')
    }
    return defaultNotaryPublicKey
  }

  const getDefaultNotarizer = () => {
    if (!defaultNotarizer) {
      throw new Error('Notarizer not provided')
    }
    return defaultNotarizer
  }

  const createTransactionIntentHeader = (
    transactionHeader?: TransactionHeader,
    notaryPublicKey?: PublicKey,
  ) =>
    transactionHeader
      ? Promise.resolve(transactionHeader)
      : createTransactionHeader(notaryPublicKey ?? getDefaultNotaryPublicKey())(
          radixNetworkClient,
        )

  const createTransactionIntentMessage = (value?: Message | string) => {
    const defaultMessage: Message = { kind: 'None' }

    return value === undefined
      ? defaultMessage
      : typeof value === 'string'
        ? createStringMessage(value)
        : value
  }

  const createTransactionIntent = ({
    manifest,
    header,
    message,
    notaryPublicKey,
  }: {
    manifest: TransactionManifest | string
    header?: TransactionHeader
    message?: Message | string
    notaryPublicKey?: PublicKey
  }): Promise<Intent> =>
    Promise.all([
      transformStringManifest(manifest),
      createTransactionIntentHeader(header, notaryPublicKey),
    ]).then(([manifest, header]) => ({
      manifest,
      header,
      message: createTransactionIntentMessage(message),
    }))

  const resolveManifest = (
    input: TransactionManifest | string | WithManifestHelper,
  ): Promise<TransactionManifest | string> => {
    if (typeof input === 'function') {
      return input({ getKnownAddresses: radixNetworkClient.getKnownAddresses })
    }
    return Promise.resolve(input)
  }

  const submitTransaction = (
    manifest: Manifest,
    options?: SubmitTransactionOptions,
  ) =>
    resolveManifest(manifest)
      .then((manifest) =>
        createTransactionIntent({
          manifest,
          header: options?.transactionHeader,
          message: options?.message,
          notaryPublicKey: options?.notaryPublicKey,
        }),
      )
      .then((intent) =>
        createTransactionHelper({
          intent,
          signer: options?.signer ?? defaultSigner,
          notarizer: options?.notarizer ?? getDefaultNotarizer(),
        })
          .signAndNotarize()
          .then(({ transactionId, compiledTransaction }) =>
            radixNetworkClient
              .submitTransaction(compiledTransaction)
              .then(() =>
                radixNetworkClient.pollTransactionStatus(
                  transactionId,
                  options?.pollingOptions,
                ),
              )
              .then((response) => ({
                transactionId,
                compiledTransaction,
                response,
              })),
          ),
      )

  const getBalances = (address: string) =>
    Promise.all([
      radixNetworkClient.getFungibleTokens(address),
      radixNetworkClient.getNonFungibleTokens(address),
    ]).then(([fungibleTokens, nonFungibleTokens]) => ({
      fungibleTokens,
      nonFungibleTokens,
    }))

  return {
    submitTransaction,
    getBalances,
    networkClient: radixNetworkClient,
    signMessage: async (message: string) => {
      if (!messageSigner) {
        throw new Error('Message signer not provided')
      }

      return Promise.resolve(message)
        .then(messageSigner)
        .then((signature) => signature.hex())
    },
  }
}
