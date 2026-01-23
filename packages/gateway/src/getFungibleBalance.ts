import type {
  StateEntityDetailsOperationRequest,
  StateEntityDetailsResponseItem,
} from '@radixdlt/babylon-gateway-api-sdk';
import { BigNumber } from 'bignumber.js';
import { Config, Effect } from 'effect';
import { EntityFungiblesPage } from './state/entityFungiblesPage';

import type { AtLedgerState, StateVersion } from './schemas';
import { StateEntityDetails } from './state/stateEntityDetails';

export type GetFungibleBalanceOutput = Effect.Effect.Success<
  Awaited<ReturnType<(typeof GetFungibleBalance)['Service']>>
>;

type GetFungibleBalanceInput = Omit<
  StateEntityDetailsOperationRequest['stateEntityDetailsRequest'],
  'at_ledger_state'
> & {
  at_ledger_state: StateVersion;
  options?: StateEntityDetailsOperationRequest['stateEntityDetailsRequest']['opt_ins'];
};

export class GetFungibleBalance extends Effect.Service<GetFungibleBalance>()(
  'GetFungibleBalance',
  {
    dependencies: [EntityFungiblesPage.Default, StateEntityDetails.Default],
    effect: Effect.gen(function* () {
      const stateEntityDetails = yield* StateEntityDetails;
      const entityFungiblesPage = yield* EntityFungiblesPage;

      const concurrency = yield* Config.number(
        'GATEWAY_GET_FUNGIBLE_BALANCE_CONCURRENCY',
      ).pipe(Config.withDefault(5));

      const getAggregatedFungibleBalance = Effect.fnUntraced(function* (
        item: StateEntityDetailsResponseItem,
        at_ledger_state: AtLedgerState,
      ) {
        const address = item.address;

        const nextCursor = item.fungible_resources?.next_cursor;
        const totalCount = item.fungible_resources?.total_count ?? 0;
        const allFungibleResources = item.fungible_resources?.items ?? [];
        const shouldFetchMore = nextCursor && totalCount > 0;

        if (shouldFetchMore) {
          const result = yield* entityFungiblesPage({
            address,
            aggregation_level: 'Global',
            cursor: nextCursor,
            at_ledger_state,
          });

          allFungibleResources.push(...result);
        }

        const fungibleResources = allFungibleResources
          .map((item) => {
            if (item.aggregation_level === 'Global') {
              const { aggregation_level, amount, ...rest } = item;

              return {
                ...rest,
                amount: new BigNumber(amount),
              };
            }
          })
          .filter((item) => item !== undefined)
          .filter((item) => item.amount.gt(0));

        return {
          address: item.address,
          items: fungibleResources,
        };
      });

      return Effect.fnUntraced(function* (input: GetFungibleBalanceInput) {
        const stateEntityDetailsResults = yield* stateEntityDetails({
          addresses: input.addresses,
          opt_ins: input.options,
          at_ledger_state: input.at_ledger_state,
          aggregation_level: 'Global',
        });

        const fungibleBalanceResults = yield* Effect.forEach(
          stateEntityDetailsResults.items,
          (item) => getAggregatedFungibleBalance(item, input.at_ledger_state),
          { concurrency },
        ).pipe(Effect.map((results) => results.flat()));

        return fungibleBalanceResults;
      });
    }),
  },
) {}
