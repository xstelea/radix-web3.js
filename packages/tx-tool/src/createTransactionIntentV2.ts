import { GatewayApiClient } from '@radix-effects/gateway';
import {
  Epoch,
  NetworkId,
  TransactionManifestString,
  TransactionMessageString,
} from '@radix-effects/shared';
import { Effect, Option, Schema } from 'effect';

import {
  ManifestSchema,
  TransactionIntentV2Schema,
  TransactionMessageV2Schema,
} from './schemas';
import { StaticallyValidateManifest } from './staticallyValidateManifest';
import { TransactionHeaderV2 } from './transactionHeaderV2';

const CreateTransactionIntentV2InputSchema = Schema.Struct({
  startEpochInclusive: Schema.optional(Epoch),
  endEpochExclusive: Schema.optional(Epoch),
  manifest: TransactionManifestString,
  message: Schema.optional(TransactionMessageString),
  tipBasisPoints: Schema.optional(Schema.Number),
  intentDiscriminator: Schema.optional(Schema.Number),
  minProposerTimestampInclusive: Schema.optional(Schema.Number),
  maxProposerTimestampExclusive: Schema.optional(Schema.Number),
});

type CreateTransactionIntentV2Input =
  typeof CreateTransactionIntentV2InputSchema.Type;

export class CreateTransactionIntentV2 extends Effect.Service<CreateTransactionIntentV2>()(
  '@radix-effects/tx-tool/CreateTransactionIntentV2',
  {
    dependencies: [
      StaticallyValidateManifest.Default,
      TransactionHeaderV2.Default,
    ],
    effect: Effect.gen(function* () {
      const staticallyValidateManifest = yield* StaticallyValidateManifest;
      const createTransactionHeaderV2 = yield* TransactionHeaderV2;
      const gatewayApiClient = yield* GatewayApiClient;

      const networkId = NetworkId.make(gatewayApiClient.networkId);

      return (input: CreateTransactionIntentV2Input) =>
        Effect.gen(function* () {
          const parsedInput = yield* Schema.decodeUnknown(
            CreateTransactionIntentV2InputSchema,
          )(input);

          const { transactionHeader, intentHeader } =
            yield* createTransactionHeaderV2({
              networkId,
              startEpochInclusive: Option.fromNullable(
                parsedInput.startEpochInclusive,
              ),
              endEpochExclusive: Option.fromNullable(
                parsedInput.endEpochExclusive,
              ),
              tipBasisPoints: parsedInput.tipBasisPoints,
              intentDiscriminator: parsedInput.intentDiscriminator,
              minProposerTimestampInclusive:
                parsedInput.minProposerTimestampInclusive,
              maxProposerTimestampExclusive:
                parsedInput.maxProposerTimestampExclusive,
            });

          const manifest = yield* Schema.decodeUnknown(ManifestSchema)(
            parsedInput.manifest,
          );

          yield* staticallyValidateManifest({
            manifest,
            networkId,
          });

          const message = yield* Schema.decodeUnknown(
            TransactionMessageV2Schema,
          )(
            parsedInput.message
              ? {
                  kind: 'PlainText' as const,
                  value: {
                    mimeType: 'text/plain',
                    message: {
                      kind: 'String' as const,
                      value: parsedInput.message,
                    },
                  },
                }
              : { kind: 'None' as const },
          );

          return TransactionIntentV2Schema.make({
            transactionHeader,
            rootIntentCore: {
              header: intentHeader,
              instructions: parsedInput.manifest,
              blobs: [],
              message,
              children: [],
            },
            nonRootSubintents: [],
          });
        });
    }),
  },
) {}
