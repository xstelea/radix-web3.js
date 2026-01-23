import { decompileTransaction } from './decompileTransaction';
import { getIntentHash } from './getIntentHash';

export const compiledTransactionToTransactionId = (
  compiledTransaction: Uint8Array,
) =>
  decompileTransaction(compiledTransaction)
    .then((notarizedTransaction) =>
      getIntentHash(notarizedTransaction.signedIntent.intent),
    )
    .then((intentHash) => intentHash.id);
