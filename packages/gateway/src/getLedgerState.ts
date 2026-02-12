import { Effect } from 'effect';
import { GatewayApiClient } from './gatewayApiClient';

import type { AtLedgerState } from './schemas';

export type GetLedgerStateInput = {
  at_ledger_state?: AtLedgerState;
};

export class GetLedgerStateService extends Effect.Service<GetLedgerStateService>()(
  'GetLedgerStateService',
  {
    effect: Effect.gen(function* () {
      const gatewayClient = yield* GatewayApiClient;
      return Effect.fn('getLedgerStateService')(function* (
        input: GetLedgerStateInput,
      ) {
        const result =
          yield* gatewayClient.stream.innerClient.streamTransactions({
            streamTransactionsRequest: {
              limit_per_page: 1,
              at_ledger_state: input.at_ledger_state,
            },
          });

        return result.ledger_state;
      });
    }),
  },
) {}
