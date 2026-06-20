import type {
  StateEntityDetailsOperationRequest,
  StateEntityDetailsResponseItem,
} from '@radixdlt/babylon-gateway-api-sdk';
import { BigNumber } from 'bignumber.js';
import { Config, Context, Effect, Layer } from 'effect';

import type { AtLedgerState } from './schemas';
import { EntityFungiblesPage } from './state/entityFungiblesPage';
import { StateEntityDetails } from './state/stateEntityDetails';

export type GetFungibleBalanceOutput = Effect.Success<
  Awaited<ReturnType<(typeof GetFungibleBalance)['Service']>>
>;

type GetFungibleBalanceInput = Omit<
  StateEntityDetailsOperationRequest['stateEntityDetailsRequest'],
  'at_ledger_state'
> & {
  at_ledger_state?: AtLedgerState;
  options?: StateEntityDetailsOperationRequest['stateEntityDetailsRequest']['opt_ins'];
};

export class GetFungibleBalance extends Context.Service<GetFungibleBalance>()(
  'GetFungibleBalance',
  {
    make: Effect.gen(function* () {
      const stateEntityDetails = yield* StateEntityDetails;
      const entityFungiblesPage = yield* EntityFungiblesPage;

      const concurrency = yield* Config.number(
        'GATEWAY_GET_FUNGIBLE_BALANCE_CONCURRENCY',
      ).pipe(Config.withDefault(5));

      const getAggregatedFungibleBalance = Effect.fn(
        'GetFungibleBalance.getAggregatedFungibleBalance',
      )(function* (
        item: StateEntityDetailsResponseItem,
        at_ledger_state?: AtLedgerState,
      ) {
        const address = item.address;
        const nextCursor = item.fungible_resources?.next_cursor;
        const initialFungibleResources = item.fungible_resources?.items ?? [];
        const pagedFungibleResources =
          nextCursor === undefined || nextCursor === null
            ? []
            : yield* entityFungiblesPage({
                address,
                aggregation_level: 'Global',
                cursor: nextCursor,
                at_ledger_state,
              });

        const fungibleResources = [
          ...initialFungibleResources,
          ...pagedFungibleResources,
        ]
          .filter((item) => item.aggregation_level === 'Global')
          .map(({ amount, ...rest }) => ({
            ...rest,
            amount: new BigNumber(amount),
          }))
          .filter((item) => item.amount.gt(0));

        return {
          address: item.address,
          items: fungibleResources,
        };
      });

      return Effect.fn('GetFungibleBalance')(function* (
        input: GetFungibleBalanceInput,
      ) {
        const stateEntityDetailsResults = yield* stateEntityDetails({
          addresses: input.addresses,
          opt_ins: input.options,
          at_ledger_state: input.at_ledger_state,
          aggregation_level: 'Global',
        });

        const paginationState = {
          state_version: stateEntityDetailsResults.ledger_state.state_version,
        };

        const fungibleBalanceResults = yield* Effect.forEach(
          stateEntityDetailsResults.items,
          (item) => getAggregatedFungibleBalance(item, paginationState),
          { concurrency },
        ).pipe(Effect.map((results) => results.flat()));

        return fungibleBalanceResults;
      });
    }),
  },
) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(
      Layer.mergeAll(EntityFungiblesPage.Default, StateEntityDetails.Default),
    ),
  );
}
