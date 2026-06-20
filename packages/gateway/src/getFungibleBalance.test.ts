import { assert, layer } from '@effect/vitest';
import type {
  EntityMetadataCollection,
  FungibleResourcesCollectionItem,
  LedgerState,
  StateEntityDetailsResponseItem,
} from '@radixdlt/babylon-gateway-api-sdk';
import { Effect, Layer } from 'effect';

import { GetFungibleBalance } from './getFungibleBalance';
import {
  EntityFungiblesPage,
  type EntityFungiblesPageInput,
} from './state/entityFungiblesPage';
import {
  StateEntityDetails,
  type StateEntityDetailsInput,
} from './state/stateEntityDetails';

const ACCOUNT_ADDRESS =
  'account_rdx12yvpng9r5u3ggqqfwva0u6vya3hjrd6jantdq72p0jm6qarg8lld2f';

const ledgerState = {
  network: 'mainnet',
  state_version: 123,
  proposer_round_timestamp: '2026-01-01T00:00:00.000Z',
  epoch: 10,
  round: 20,
} satisfies LedgerState;

const emptyMetadata = {
  items: [],
} satisfies EntityMetadataCollection;

const globalResource = (
  resourceAddress: string,
  amount: string,
): FungibleResourcesCollectionItem => ({
  aggregation_level: 'Global',
  resource_address: resourceAddress,
  amount,
  last_updated_at_state_version: ledgerState.state_version,
});

const accountDetails = {
  address: ACCOUNT_ADDRESS,
  metadata: emptyMetadata,
  fungible_resources: {
    next_cursor: 'next-page',
    items: [globalResource('resource_rdx1first', '1.5')],
  },
} satisfies StateEntityDetailsResponseItem;

const stateEntityDetailsLayer = Layer.succeed(
  StateEntityDetails,
  Effect.fn('testStateEntityDetails')((_input: StateEntityDetailsInput) =>
    Effect.succeed({
      ledger_state: ledgerState,
      items: [accountDetails],
    }),
  ),
);

const entityFungiblesPageLayer = Layer.succeed(
  EntityFungiblesPage,
  Effect.fn('testEntityFungiblesPage')((input: EntityFungiblesPageInput) =>
    Effect.sync(() => {
      assert.deepStrictEqual(input.at_ledger_state, {
        state_version: ledgerState.state_version,
      });

      return [
        globalResource('resource_rdx1second', '2'),
        globalResource('resource_rdx1zero', '0'),
      ];
    }),
  ),
);

const testLayer = GetFungibleBalance.DefaultWithoutDependencies.pipe(
  Layer.provide(
    Layer.mergeAll(stateEntityDetailsLayer, entityFungiblesPageLayer),
  ),
);

layer(testLayer)('GetFungibleBalance', (it) => {
  it.effect(
    'returns positive global balances from initial and cursor pages',
    Effect.fn('getFungibleBalancePaginationTest')(function* () {
      const getFungibleBalance = yield* GetFungibleBalance;

      const result = yield* getFungibleBalance({
        addresses: [ACCOUNT_ADDRESS],
      });

      assert.deepStrictEqual(
        result.map((account) => ({
          address: account.address,
          items: account.items.map((item) => ({
            resource_address: item.resource_address,
            amount: item.amount.toString(10),
          })),
        })),
        [
          {
            address: ACCOUNT_ADDRESS,
            items: [
              { resource_address: 'resource_rdx1first', amount: '1.5' },
              { resource_address: 'resource_rdx1second', amount: '2' },
            ],
          },
        ],
      );
    }),
  );
});
