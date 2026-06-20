import { GatewayApiClient } from '@radix-effects/gateway';
import {
  Epoch,
  NetworkId,
  TransactionManifestString,
  TransactionMessageString,
} from '@radix-effects/shared';
import { Context, Effect, Layer, Option, Schema } from 'effect';

import {
  ManifestSchema,
  TransactionIntentSchema,
  TransactionMessageSchema,
} from './schemas';
import { StaticallyValidateManifest } from './staticallyValidateManifest';
import { TransactionHeader } from './transactionHeader';

const CreateTransactionIntentInputSchema = Schema.Struct({
  startEpochInclusive: Schema.optional(Epoch),
  endEpochExclusive: Schema.optional(Epoch),
  manifest: TransactionManifestString,
  message: Schema.optional(TransactionMessageString),
  tipPercentage: Schema.optional(Schema.Number),
});

type CreateTransactionIntentInput =
  typeof CreateTransactionIntentInputSchema.Type;

export class CreateTransactionIntent extends Context.Service<CreateTransactionIntent>()(
  '@radix-effects/tx-tool/CreateTransactionIntent',
  {
    make: Effect.gen(function* () {
      const staticallyValidateManifest = yield* StaticallyValidateManifest;
      const createTransactionHeader = yield* TransactionHeader;
      const gatewayApiClient = yield* GatewayApiClient;

      const networkId = NetworkId.make(gatewayApiClient.networkId);

      return (input: CreateTransactionIntentInput) =>
        Effect.gen(function* () {
          const parsedInput = yield* Schema.decodeUnknownEffect(
            CreateTransactionIntentInputSchema,
          )(input);

          const header = yield* createTransactionHeader({
            networkId: networkId,
            startEpochInclusive: Option.fromNullishOr(
              parsedInput.startEpochInclusive,
            ),
            endEpochExclusive: Option.fromNullishOr(
              parsedInput.endEpochExclusive,
            ),
          });

          const message = yield* Schema.decodeUnknownEffect(
            TransactionMessageSchema,
          )(parsedInput.message);

          const manifest = yield* Schema.decodeUnknownEffect(ManifestSchema)(
            parsedInput.manifest,
          );

          const transactionIntent = {
            header,
            message,
            manifest,
          };

          yield* staticallyValidateManifest({
            manifest,
            networkId,
          });

          return TransactionIntentSchema.make(transactionIntent);
        });
    }),
  },
) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(StaticallyValidateManifest.Default),
    Layer.provide(TransactionHeader.Default),
  );
}
