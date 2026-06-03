import type { EntityFungiblesPageRequest } from '@radixdlt/babylon-gateway-api-sdk';
import { Config, Effect } from 'effect';

import { GatewayApiClient } from '../gatewayApiClient';
import type { AtLedgerState } from '../schemas';

type EntityFungiblesPageInput = Omit<
  EntityFungiblesPageRequest['stateEntityFungiblesPageRequest'],
  'at_ledger_state'
> & {
  at_ledger_state?: AtLedgerState;
};

export class EntityFungiblesPage extends Effect.Service<EntityFungiblesPage>()(
  'EntityFungiblesPage',
  {
    effect: Effect.gen(function* () {
      const gatewayClient = yield* GatewayApiClient;
      const pageSize = yield* Config.number(
        'GatewayApi__Endpoint__MaxPageSize',
      ).pipe(Config.withDefault(100));

      const entityFungiblesPage = Effect.fnUntraced(function* (
        input: EntityFungiblesPageInput,
      ) {
        const result =
          yield* gatewayClient.state.innerClient.entityFungiblesPage({
            stateEntityFungiblesPageRequest: {
              ...input,
              limit_per_page: pageSize,
            },
          });
        return result;
      });

      const entityFungiblePageExhaustive = Effect.fnUntraced(function* (
        input: EntityFungiblesPageInput,
      ) {
        const result = yield* entityFungiblesPage(input);
        const paginationState = {
          state_version: result.ledger_state.state_version,
        };
        let nextCursor = result?.next_cursor;

        const items = result?.items ?? [];

        while (nextCursor) {
          const result = yield* entityFungiblesPage({
            ...input,
            at_ledger_state: paginationState,
            cursor: nextCursor,
          });
          nextCursor = result.next_cursor;
          items.push(...result.items);
        }

        return items;
      });

      return entityFungiblePageExhaustive;
    }),
  },
) {}
