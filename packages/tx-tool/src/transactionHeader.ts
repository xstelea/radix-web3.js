import { GetLedgerStateService } from '@radix-effects/gateway';
import { Epoch, type NetworkId, Nonce } from '@radix-effects/shared';
import { generateRandomNonce } from '@steleaio/radix-engine-toolkit';
import { Context, Data, Effect, Layer, Option, pipe } from 'effect';

import { EpochService } from './epoch';
import { NotaryKeyPair } from './notaryKeyPair';
import { TransactionHeaderSchema } from './schemas';

export class InvalidEpochError extends Data.TaggedError('InvalidEpochError')<{
  message: string;
}> {}

export type CreateTransactionHeaderInput = {
  networkId: NetworkId;
  startEpochInclusive: Option.Option<Epoch>;
  endEpochExclusive: Option.Option<Epoch>;
  tipPercentage?: number;
  nonce?: Nonce;
  notaryIsSignatory?: boolean;
};

export class TransactionHeader extends Context.Service<TransactionHeader>()(
  '@radix-effects/tx-tool/TransactionHeader',
  {
    make: Effect.gen(function* () {
      const notaryKeyPair = yield* NotaryKeyPair;
      const epochService = yield* EpochService;

      const generateNonce = () => pipe(generateRandomNonce(), Nonce.make);

      return (input: CreateTransactionHeaderInput) =>
        Effect.gen(function* () {
          const {
            tipPercentage = 0,
            nonce = generateNonce(),
            notaryIsSignatory = false,
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

          return TransactionHeaderSchema.make({
            networkId: input.networkId,
            startEpochInclusive,
            endEpochExclusive,
            notaryPublicKey: notaryPublicKey,
            nonce,
            notaryIsSignatory,
            tipPercentage,
          });
        });
    }),
  },
) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(GetLedgerStateService.Default),
    Layer.provide(NotaryKeyPair.Default),
    Layer.provide(EpochService.Default),
  );
}
