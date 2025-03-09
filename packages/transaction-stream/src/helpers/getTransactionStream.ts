import { fetchWrapper } from './fetchWrapper'
import {
  type StreamTransactionsResponse,
  type ErrorResponse as GatewayErrorResponse,
} from '@radixdlt/babylon-gateway-api-sdk'

export type TransactionStreamCaller = ReturnType<
  typeof createTransactionStreamCaller
>

export const TransactionStreamError = {
  StateVersionBeyondEndOfKnownLedger: 'StateVersionBeyondEndOfKnownLedger',
} as const

export type TransactionStreamError =
  (typeof TransactionStreamError)[keyof typeof TransactionStreamError]

export const createTransactionStreamCaller =
  ({
    baseUrl,
    numberOfTransactions,
  }: {
    baseUrl: string
    numberOfTransactions: number
  }) =>
  (fromStateVersion: number) =>
    fetchWrapper<
      StreamTransactionsResponse,
      GatewayErrorResponse & { parsedError?: TransactionStreamError }
    >(
      fetch(`${baseUrl}/stream/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          limit_per_page: numberOfTransactions,
          kind_filter: 'User',
          order: 'Asc',
          from_ledger_state: { state_version: fromStateVersion },
          opt_ins: {
            receipt_events: true,
          },
        }),
      }),
    ).mapErr((error) => {
      if (
        error.reason === 'RequestStatusNotOk' &&
        error.data.details?.type === 'InvalidRequestError'
      ) {
        const isStateVersionBeyondEnd =
          error.data.details.validation_errors.find((item) =>
            item.errors.some(
              (text) =>
                text === 'State version is beyond the end of the known ledger',
            ),
          )

        if (isStateVersionBeyondEnd) {
          return {
            ...error,
            parsedError:
              TransactionStreamError.StateVersionBeyondEndOfKnownLedger,
          }
        }
      }

      return error
    })
