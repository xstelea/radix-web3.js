import { HexString } from '@radix-effects/shared';
import {
  Convert,
  type NotarizedTransaction,
  type NotarizedTransactionV2,
  RadixEngineToolkit,
  TransactionBuilder as RetTransactionBuilder,
  TransactionV2Builder as RetTransactionV2Builder,
} from '@steleaio/radix-engine-toolkit';
import { Data, Effect, Schema, pipe } from 'effect';

import { NotaryKeyPair } from './notaryKeyPair';
import {
  Ed25519SignatureWithPublicKeySchema,
  type TransactionIntent,
  TransactionIntentSchema,
  type TransactionIntentV2,
  TransactionIntentV2Schema,
} from './schemas';

export class FailedToCompileTransactionError extends Data.TaggedError(
  'FailedToCompileTransactionError',
)<{
  error: unknown;
}> {}

export class FailedToNotarizeTransactionError extends Data.TaggedError(
  'FailedToNotarizeTransactionError',
)<{
  error: unknown;
}> {}

const CompileTransactionInputSchema = Schema.Struct({
  intent: Schema.Union(TransactionIntentSchema, TransactionIntentV2Schema),
  signatures: Schema.Array(Ed25519SignatureWithPublicKeySchema),
  subintentSignatures: Schema.optional(
    Schema.Array(Schema.Array(Ed25519SignatureWithPublicKeySchema)),
  ),
});

type CompileTransactionInput = typeof CompileTransactionInputSchema.Type;

export class CompileTransaction extends Effect.Service<CompileTransaction>()(
  '@radix-effects/tx-tool/CompileTransaction',
  {
    dependencies: [NotaryKeyPair.Default],
    effect: Effect.gen(function* () {
      const notaryKeyPair = yield* NotaryKeyPair;

      const TransactionBuilder = Effect.tryPromise(() =>
        RetTransactionBuilder.new(),
      ).pipe(Effect.catchAll(Effect.orDie));

      const TransactionV2Builder = Effect.tryPromise(() =>
        RetTransactionV2Builder.new(),
      ).pipe(Effect.catchAll(Effect.orDie));

      const notarySignToSignature = (hash: Uint8Array<ArrayBufferLike>) =>
        pipe(
          Convert.Uint8Array.toHexString(hash),
          HexString.make,
          notaryKeyPair.signToSignature,
        ).pipe(Effect.runPromise);

      const isTransactionIntentV2 = (
        intent: CompileTransactionInput['intent'],
      ): intent is TransactionIntentV2 => 'transactionHeader' in intent;

      const notarizeTransaction = (input: CompileTransactionInput) =>
        Effect.gen(function* () {
          const intent = input.intent;

          if (isTransactionIntentV2(intent)) {
            const builder = yield* TransactionV2Builder;
            let builderStep = builder
              .header(intent.transactionHeader)
              .rootIntentCore(intent.rootIntentCore);

            for (let i = 0; i < intent.nonRootSubintents.length; i++) {
              builderStep = builderStep.addSignedSubintent(
                intent.nonRootSubintents[i],
                [...(input.subintentSignatures?.[i] ?? [])],
              );
            }

            for (const signature of input.signatures) {
              builderStep = builderStep.sign(signature);
            }

            return yield* Effect.tryPromise({
              try: () => builderStep.notarizeAsync(notarySignToSignature),
              catch: (error) => new FailedToNotarizeTransactionError({ error }),
            });
          }

          const v1Intent: TransactionIntent = intent;
          const builder = yield* TransactionBuilder;
          let builderStep = builder
            .header(v1Intent.header)
            .message(v1Intent.message)
            .manifest(v1Intent.manifest);

          for (const signature of input.signatures) {
            builderStep = builderStep.sign(signature);
          }

          return yield* Effect.tryPromise({
            try: () => builderStep.notarizeAsync(notarySignToSignature),
            catch: (error) => new FailedToNotarizeTransactionError({ error }),
          });
        });

      const compileNotarizedTransaction = (
        input: NotarizedTransaction | NotarizedTransactionV2,
      ) =>
        Effect.tryPromise({
          try: () =>
            'signedTransactionIntent' in input
              ? RadixEngineToolkit.NotarizedTransactionV2.compile(input)
              : RadixEngineToolkit.NotarizedTransaction.compile(input),
          catch: (error) => new FailedToCompileTransactionError({ error }),
        });

      return (input: CompileTransactionInput) =>
        notarizeTransaction(input).pipe(
          Effect.flatMap(compileNotarizedTransaction),
        );
    }),
  },
) {}
