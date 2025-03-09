import { GetTransactionsOutput, Transaction } from '../types'
import { Logger } from './logger'

export type TransformTransactionResultOutput = {
  previousStateVersion: number
  stateVersion: number
  transactions: Transaction[]
}

export const transformTransactionResult = (
  result: GetTransactionsOutput,
  stateVersion: number,
  logger?: Logger,
): TransformTransactionResultOutput => {
  const { transactions, ledgerStateVersion } = result

  // no transactions found at current state version, try again with the same stateVersion we passed in
  if (transactions.length === 0)
    return {
      previousStateVersion: stateVersion,
      stateVersion,
      transactions,
    }

  const firstTransaction = transactions[0]
  const lastTransaction = transactions.slice(-1)[0]

  const lastStateVersion = lastTransaction.state_version
  const nextStateVersion = lastStateVersion + 1
  logger?.trace({
    method: 'handleTransactionResult.success',
    items: transactions.length,
    stateVersionRange: {
      start: firstTransaction.state_version,
      end: lastStateVersion,
    },
    nextStateVersion,
    ledgerStateVersion,
  })

  return {
    previousStateVersion: stateVersion,
    stateVersion: nextStateVersion,
    transactions,
  }
}
