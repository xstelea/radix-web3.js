import {
  type Intent,
  RadixEngineToolkit,
} from '@radixdlt/radix-engine-toolkit';

/**
 * Gets the hash of a transaction intent from a notarized transaction
 * @param notarizedTransaction - The notarized transaction containing the intent to hash
 * @returns A Promise that resolves to the transaction intent hash
 */
export const getIntentHash = (intent: Intent) =>
  RadixEngineToolkit.Intent.hash(intent);
