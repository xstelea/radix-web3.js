import { RadixEngineToolkit } from '@steleaio/radix-engine-toolkit';

export const decompileTransaction = (compiledTransaction: Uint8Array) =>
  RadixEngineToolkit.NotarizedTransaction.decompile(compiledTransaction);
