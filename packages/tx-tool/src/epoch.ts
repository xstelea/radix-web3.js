import { GetLedgerStateService } from '@radix-effects/gateway';
import { Data, Effect } from 'effect';
import { Epoch, type TransactionId } from '@radix-effects/shared';
import type { TransactionIntent } from './schemas';

export class InvalidEndEpochError extends Data.TaggedError(
  'InvalidEndEpochError',
)<{
  message: string;
  transactionId: TransactionId;
}> {}

export class InvalidStartEpochError extends Data.TaggedError(
  'InvalidStartEpochError',
)<{
  message: string;
  transactionId: TransactionId;
}> {}

export class EpochService extends Effect.Service<EpochService>()(
  'EpochService',
  {
    dependencies: [GetLedgerStateService.Default],
    effect: Effect.gen(function* () {
      const getLedgerStateService = yield* GetLedgerStateService;

      const getCurrentEpoch = () =>
        Effect.gen(function* () {
          return yield* getLedgerStateService({
            at_ledger_state: {
              timestamp: new Date(),
            },
          }).pipe(Effect.map((ledgerState) => Epoch.make(ledgerState.epoch)));
        });

      return {
        getCurrentEpoch,
        verifyEpochBounds: (input: {
          transactionId: TransactionId;
          transactionIntent: TransactionIntent;
        }) =>
          Effect.gen(function* () {
            const currentEpoch = yield* getCurrentEpoch();

            if (
              currentEpoch < input.transactionIntent.header.startEpochInclusive
            ) {
              return yield* new InvalidStartEpochError({
                message: `Current epoch ${currentEpoch} is less than start epoch ${input.transactionIntent.header.startEpochInclusive}`,
                transactionId: input.transactionId,
              });
            }

            if (
              currentEpoch >= input.transactionIntent.header.endEpochExclusive
            ) {
              return yield* new InvalidEndEpochError({
                message: `Current epoch ${currentEpoch} is greater than or equal to end epoch ${input.transactionIntent.header.endEpochExclusive}`,
                transactionId: input.transactionId,
              });
            }
          }),
      };
    }),
  },
) {}
