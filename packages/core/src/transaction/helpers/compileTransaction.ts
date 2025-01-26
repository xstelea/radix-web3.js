import { RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit'
import { NotarizedTransaction } from '@radixdlt/radix-engine-toolkit'

/**
 * Compiles a notarized transaction to a hexadecimal string
 * @param notarizedTransaction - The notarized transaction to compile
 * @returns A Promise that resolves to the compiled transaction as a hexadecimal string
 */
export const compileTransaction = (
  notarizedTransaction: NotarizedTransaction,
) => RadixEngineToolkit.NotarizedTransaction.compile(notarizedTransaction)
