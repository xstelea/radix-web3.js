import { RadixEngineToolkit } from '@steleaio/radix-engine-toolkit';
import type { NotarizedTransaction } from '@steleaio/radix-engine-toolkit';

/**
 * Compiles a notarized transaction to a hexadecimal string
 * @param notarizedTransaction - The notarized transaction to compile
 * @returns A Promise that resolves to the compiled transaction as a hexadecimal string
 */
export const compileTransaction = (
  notarizedTransaction: NotarizedTransaction,
) => RadixEngineToolkit.NotarizedTransaction.compile(notarizedTransaction);
