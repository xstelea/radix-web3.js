import { GetLedgerStateService } from '@radix-effects/gateway';
import { Epoch, type TransactionId } from '@radix-effects/shared';
import { Data, Effect } from 'effect';

import type { TransactionIntent, TransactionIntentV2 } from './schemas';

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
  '@radix-effects/tx-tool/EpochService',
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
          transactionIntent: TransactionIntent | TransactionIntentV2;
        }) =>
          Effect.gen(function* () {
            const currentEpoch = yield* getCurrentEpoch();

            const header =
              'transactionHeader' in input.transactionIntent
                ? input.transactionIntent.rootIntentCore.header
                : input.transactionIntent.header;

            if (currentEpoch < header.startEpochInclusive) {
              return yield* new InvalidStartEpochError({
                message: `Current epoch ${currentEpoch} is less than start epoch ${header.startEpochInclusive}`,
                transactionId: input.transactionId,
              });
            }

            if (currentEpoch >= header.endEpochExclusive) {
              return yield* new InvalidEndEpochError({
                message: `Current epoch ${currentEpoch} is greater than or equal to end epoch ${header.endEpochExclusive}`,
                transactionId: input.transactionId,
              });
            }
          }),
      };
    }),
  },
) {}
