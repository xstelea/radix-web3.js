import { Epoch, type NetworkId } from '@radix-effects/shared';
import { Context, Effect, Layer, Option } from 'effect';

import { EpochService } from './epoch';
import { NotaryKeyPair } from './notaryKeyPair';
import {
  type IntentHeaderV2,
  IntentHeaderV2Schema,
  TransactionHeaderV2Schema,
  type TransactionHeaderV2 as TransactionHeaderV2Type,
} from './schemas';
import { InvalidEpochError } from './transactionHeader';

export type CreateTransactionHeaderV2Input = {
  networkId: NetworkId;
  startEpochInclusive: Option.Option<Epoch>;
  endEpochExclusive: Option.Option<Epoch>;
  tipBasisPoints?: number;
  notaryIsSignatory?: boolean;
  intentDiscriminator?: number;
  minProposerTimestampInclusive?: number;
  maxProposerTimestampExclusive?: number;
};

export type CreateTransactionHeaderV2Output = {
  transactionHeader: TransactionHeaderV2Type;
  intentHeader: IntentHeaderV2;
};

export class TransactionHeaderV2 extends Context.Service<TransactionHeaderV2>()(
  '@radix-effects/tx-tool/TransactionHeaderV2',
  {
    make: Effect.gen(function* () {
      const notaryKeyPair = yield* NotaryKeyPair;
      const epochService = yield* EpochService;

      return (input: CreateTransactionHeaderV2Input) =>
        Effect.gen(function* () {
          const {
            tipBasisPoints = 0,
            notaryIsSignatory = false,
            intentDiscriminator = 0,
            minProposerTimestampInclusive,
            maxProposerTimestampExclusive,
          } = input;

          const currentEpoch = yield* epochService.getCurrentEpoch();

          const startEpochInclusive = Option.match(input.startEpochInclusive, {
            onSome: (epoch) => epoch,
            onNone: () => currentEpoch,
          });

          if (currentEpoch < startEpochInclusive)
            return yield* new InvalidEpochError({
              message: `Current epoch ${currentEpoch} is less than start epoch ${input.startEpochInclusive}`,
            });

          const endEpochExclusive = Option.match(input.endEpochExclusive, {
            onSome: (epoch) => epoch,
            onNone: () => Epoch.make(currentEpoch + 2),
          });

          if (currentEpoch >= endEpochExclusive)
            return yield* new InvalidEpochError({
              message: `Current epoch ${currentEpoch} is greater than or equal to end epoch ${input.endEpochExclusive}`,
            });

          const notaryPublicKey = yield* notaryKeyPair.publicKey();

          return {
            transactionHeader: TransactionHeaderV2Schema.make({
              notaryPublicKey,
              notaryIsSignatory,
              tipBasisPoints,
            }),
            intentHeader: IntentHeaderV2Schema.make({
              networkId: input.networkId,
              startEpochInclusive,
              endEpochExclusive,
              minProposerTimestampInclusive,
              maxProposerTimestampExclusive,
              intentDiscriminator,
            }),
          };
        });
    }),
  },
) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(NotaryKeyPair.Default),
    Layer.provide(EpochService.Default),
  );
}
