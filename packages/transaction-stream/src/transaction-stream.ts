import { ResultAsync } from 'neverthrow'
import { createLogger, type Logger } from './helpers/logger'
import { transformTransactionResult } from './helpers/transformTransactionResult'
import { RadixNetworkClient, createRadixNetworkClient } from 'radix-web3.js'
import { GetTransactionsOutput, GetTransactionsErrorOutput } from './types'
import { createTransactionStreamCaller } from './helpers/getTransactionStream'
import { createStateVersionManager } from './helpers/stateVersionManager'
export type TransactionStream = ReturnType<typeof createTransactionStream>

export type TransactionStreamInput = Partial<{
  gatewayApi: RadixNetworkClient
  startStateVersion: number
  numberOfTransactions: number
  debug?: boolean
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'trace'
}>

export const createTransactionStream = (input?: TransactionStreamInput) => {
  const {
    gatewayApi = createRadixNetworkClient({ networkId: 1 }),
    startStateVersion,
    numberOfTransactions = 100,
    debug,
    logLevel = 'debug',
  } = input ?? {}

  const logger = debug ? createLogger({ level: logLevel }) : undefined

  const stateVersionManager = createStateVersionManager({
    gatewayApi,
    startStateVersion,
    logger,
  })

  const getTransactionStream = createTransactionStreamCaller({
    baseUrl: gatewayApi.networkConfig.gatewayUrl,
    numberOfTransactions,
  })

  const getTransactions = (
    fromStateVersion: number,
  ): ResultAsync<GetTransactionsOutput, GetTransactionsErrorOutput> => {
    logger?.trace({
      method: 'getTransactions',
      fromStateVersion,
    })

    return getTransactionStream(fromStateVersion)
      .map(({ data: response, status }): GetTransactionsOutput => {
        logger?.trace({
          method: 'getTransactions',
          event: 'success',
          status,
          items: response.items.length,
          ledgerStateVersion: response.ledger_state.state_version,
        })
        return {
          transactions: response.items,
          ledgerStateVersion: response.ledger_state.state_version,
        }
      })
      .mapErr((error) => {
        logger?.trace({ method: 'getTransactions', event: 'error', error })

        if (
          error.reason === 'RequestStatusNotOk' &&
          error.data.details?.type === 'InvalidRequestError'
        ) {
          const isStateVersionBeyondEnd =
            error.data.details.validation_errors.find((item) =>
              item.errors.some(
                (text) =>
                  text ===
                  'State version is beyond the end of the known ledger',
              ),
            )

          if (isStateVersionBeyondEnd) {
            return {
              ...error,
              error: 'StateVersionBeyondEndOfKnownLedger',
            }
          }
        }

        return error
      })
  }

  const next = () =>
    stateVersionManager
      .getStateVersion()
      .andThen((stateVersion) =>
        getTransactions(stateVersion).map((result) =>
          transformTransactionResult(result, stateVersion),
        ),
      )
      .andTee((result) => {
        stateVersionManager.setStateVersion(result.stateVersion)
      })

  return {
    next,
    setStateVersion: stateVersionManager.setStateVersion,
    getStateVersion: stateVersionManager.getStateVersion,
  }
}
