import {
  type StreamTransactionsResponse,
  type ErrorResponse as GatewayErrorResponse,
} from '@radixdlt/babylon-gateway-api-sdk'
import { type FetchWrapperError } from './helpers/fetchWrapper'
import type { Result } from 'neverthrow'

export type Transaction = StreamTransactionsResponse['items'][0]

export type GetTransactionsOutput = {
  transactions: Transaction[]
  ledgerStateVersion: number
}

export type GetTransactionsErrorOutput = FetchWrapperError<GatewayErrorResponse>

export type GetTransactionsAwaitedResult = Result<
  GetTransactionsOutput,
  GetTransactionsErrorOutput
>
