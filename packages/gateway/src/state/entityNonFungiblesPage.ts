import type { EntityNonFungiblesPageRequest } from '@radixdlt/babylon-gateway-api-sdk';
import { Config, Effect } from 'effect';
import { GatewayApiClient } from '../gatewayApiClient';
import type { AtLedgerState } from '../schemas';

export class EntityNonFungiblesPage extends Effect.Service<EntityNonFungiblesPage>()(
  'EntityNonFungiblesPage',
  {
    effect: Effect.gen(function* () {
      const gatewayClient = yield* GatewayApiClient;
      const pageSize = yield* Config.number(
        'GatewayApi__Endpoint__MaxPageSize',
      ).pipe(Config.withDefault(100));

      return Effect.fnUntraced(function* (
        input: Omit<
          EntityNonFungiblesPageRequest['stateEntityNonFungiblesPageRequest'],
          'at_ledger_state'
        > & {
          at_ledger_state: AtLedgerState;
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
) {}
