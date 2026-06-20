import { Context, Effect, Layer } from 'effect';

import { GatewayApiClient } from './gatewayApiClient';
import type { AtLedgerState } from './schemas';

export type GetLedgerStateInput = {
  at_ledger_state?: AtLedgerState;
};

export class GetLedgerStateService extends Context.Service<GetLedgerStateService>()(
  'GetLedgerStateService',
  {
    make: Effect.gen(function* () {
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
) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(GatewayApiClient.Default),
  );
}
