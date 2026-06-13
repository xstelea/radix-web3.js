import type { EntityNonFungiblesPageRequest } from '@radixdlt/babylon-gateway-api-sdk';
import { Config, Context, Effect, Layer } from 'effect';

import { GatewayApiClient } from '../gatewayApiClient';
import type { AtLedgerState } from '../schemas';

export class EntityNonFungiblesPage extends Context.Service<EntityNonFungiblesPage>()(
  'EntityNonFungiblesPage',
  {
    make: Effect.gen(function* () {
      const gatewayClient = yield* GatewayApiClient;
      const pageSize = yield* Config.number(
        'GatewayApi__Endpoint__MaxPageSize',
      ).pipe(Config.withDefault(100));

      return Effect.fn('EntityNonFungiblesPage')(function* (
        input: Omit<
          EntityNonFungiblesPageRequest['stateEntityNonFungiblesPageRequest'],
          'at_ledger_state'
        > & {
          at_ledger_state?: AtLedgerState;
        },
      ) {
        const result =
          yield* gatewayClient.state.innerClient.entityNonFungiblesPage({
            stateEntityNonFungiblesPageRequest: {
              ...input,
              limit_per_page: pageSize,
            },
          });

        return result;
      });
    }),
  },
) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(GatewayApiClient.Default),
  );
}
