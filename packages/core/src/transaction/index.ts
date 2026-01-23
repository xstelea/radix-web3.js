import {
  type Intent,
  type Signature,
  type SignatureWithPublicKey,
  TransactionBuilder,
  type TransactionBuilderIntentSignaturesStep,
  type TransactionHash,
} from '@radixdlt/radix-engine-toolkit';
import { compileTransaction } from './helpers/compileTransaction';
import { getIntentHash } from './helpers/getIntentHash';

export type TransactionHelper = ReturnType<typeof createTransactionHelper>;

export type TransactionSigner = (
  hash: Uint8Array,
) =>
  | Promise<SignatureWithPublicKey | SignatureWithPublicKey[]>
  | SignatureWithPublicKey
  | SignatureWithPublicKey[];

export type TransactionNotarizer = (
  hash: Uint8Array,
) => Promise<Signature> | Signature;

export const createTransactionHelper = ({
  intent,
  signer = () => [],
  notarizer,
}: {
  intent: Intent;
  signer?: TransactionSigner;
  notarizer: TransactionNotarizer;
}) => {
  /**
   * Signs the transaction intent with one or more signatures
   * @param intentHash - Hash of the transaction intent to sign
   * @param builder - Transaction builder in the intent signatures step
   * @returns Promise resolving to the builder with signatures added
   */
  const signProcedure = ({
    intentHash,
    builder,
  }: {
    builder: TransactionBuilderIntentSignaturesStep;
    intentHash: TransactionHash;
  }) =>
    Promise.resolve(intentHash)
      .then(({ hash }) => signer(hash))
      .then((value) => (Array.isArray(value) ? value : [value]))
      .then((signatures) => {
        signatures.forEach(builder.sign);
        return builder;
      });

  /**
   * Prepares a transaction builder with the intent (header, message, manifest)
   * @returns Promise resolving to an object containing:
   * - builder: TransactionBuilder initialized with the intent
   * - intent: The full transaction intent
   * - intentHash: Hash of the intent for signing
   */
  const prepareBuildProcedure = () =>
    Promise.all([TransactionBuilder.new(), getIntentHash(intent)]).then(
      ([builder, intentHash]) => ({
        builder: builder
          .header(intent.header)
          .message(intent.message)
          .manifest(intent.manifest),
        intentHash,
      }),
    );

  const signAndNotarize = async (): Promise<{
    transactionId: string;
    compiledTransaction: Uint8Array;
  }> =>
    prepareBuildProcedure().then(({ intentHash, builder }) =>
      signProcedure({ builder, intentHash }).then((builder) =>
        builder
          .notarizeAsync(async (messageHash) => notarizer(messageHash))
          .then(compileTransaction)
          .then((compiledTransaction) => ({
            compiledTransaction,
            transactionId: intentHash.id,
          })),
      ),
    );

  return {
    signAndNotarize,
  };
};
