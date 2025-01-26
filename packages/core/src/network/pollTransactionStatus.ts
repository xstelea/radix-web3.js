import {
  GatewayApiClient,
  TransactionStatusResponse,
} from '@radixdlt/babylon-gateway-api-sdk'

export type PollTransactionStatusOptions = Partial<{
  abortSignal: AbortSignal
  baseDelay: number
  maxRetries: number
  maxDelay: number
  delayFn: (retry: number) => number
}>

export const pollTransactionStatusFactory =
  (gatewayApiClient: GatewayApiClient) =>
  (transactionId: string, options?: PollTransactionStatusOptions) => {
    const {
      abortSignal,
      baseDelay = 1000,
      maxRetries = 10,
      maxDelay = 10000,
      delayFn = (retry: number) =>
        Math.min(baseDelay * Math.pow(2, retry), maxDelay),
    } = options || {}

    return new Promise<TransactionStatusResponse>(async (resolve, reject) => {
      let response: TransactionStatusResponse | undefined
      let retry = 0

      if (abortSignal?.aborted) {
        reject(new Error('Transaction polling was aborted'))
        return
      }

      abortSignal?.addEventListener(
        'abort',
        () => {
          reject(new Error('Transaction polling was aborted'))
        },
        { once: true },
      )

      while (!response && retry < maxRetries) {
        const result =
          await gatewayApiClient.transaction.getStatus(transactionId)

        if (result.intent_status !== 'Pending') {
          response = result
          break
        }

        const delay = delayFn(retry)
        retry = retry + 1
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      if (!response) {
        reject(new Error('Transaction polling timed out'))
        return
      }

      resolve(response)
    })
  }
