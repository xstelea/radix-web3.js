import type { EntityFungiblesPageRequest } from '@radixdlt/babylon-gateway-api-sdk';
import { Config, Context, Effect, Layer } from 'effect';

import { GatewayApiClient } from '../gatewayApiClient';
import type { AtLedgerState } from '../schemas';

export type EntityFungiblesPageInput = Omit<
  EntityFungiblesPageRequest['stateEntityFungiblesPageRequest'],
  'at_ledger_state'
> & {
  at_ledger_state?: AtLedgerState;
};

export class EntityFungiblesPage extends Context.Service<EntityFungiblesPage>()(
  'EntityFungiblesPage',
  {
    make: Effect.gen(function* () {
      const gatewayClient = yield* GatewayApiClient;
      const pageSize = yield* Config.number(
        'GatewayApi__Endpoint__MaxPageSize',
      ).pipe(Config.withDefault(100));

      const entityFungiblesPage = Effect.fn('EntityFungiblesPage.getPage')(
        function* (input: EntityFungiblesPageInput) {
          const result =
            yield* gatewayClient.state.innerClient.entityFungiblesPage({
              stateEntityFungiblesPageRequest: {
                ...input,
                limit_per_page: pageSize,
              },
            });
          return result;
        },
      );

      const entityFungiblePageExhaustive = Effect.fn(
        'EntityFungiblesPage.exhaustive',
      )(function* (input: EntityFungiblesPageInput) {
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
) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(GatewayApiClient.Default),
  );
}
