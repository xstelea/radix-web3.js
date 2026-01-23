import { layer } from '@effect/vitest';
import { Effect } from 'effect';
import { GatewayApiClient } from './gatewayApiClient';
import { GetFungibleBalance } from './getFungibleBalance';

const ACCOUNT_ADDRESSES = [
  'account_rdx12yvpng9r5u3ggqqfwva0u6vya3hjrd6jantdq72p0jm6qarg8lld2f',
  'account_rdx1cx26ckdep9t0lut3qaz3q8cj9wey3tdee0rdxhc5f0nce64lw5gt70',
  'account_rdx168nr5dwmll4k2x5apegw5dhrpejf3xac7khjhgjqyg4qddj9tg9v4d',
  'account_rdx168fjn9fcts5h59k3z64acp8xszz8sf2a66hnw050vdnkurullz9rge',
];

layer(GetFungibleBalance.Default)('GetFungibleBalance', (it) => {
  it.effect(
    'should get account balance',
    Effect.fnUntraced(function* () {
      const getFungibleBalance = yield* GetFungibleBalance;
      const gatewayApiClient = yield* Effect.provide(
        GatewayApiClient,
        GatewayApiClient.Default,
      );

      const ledgerState =
        yield* gatewayApiClient.stream.innerClient.streamTransactions({
          streamTransactionsRequest: {
            limit_per_page: 100,
            at_ledger_state: {
              timestamp: new Date('2025-09-03T00:00:00.000Z'),
            },
          },
        });

      yield* getFungibleBalance({
        addresses: ACCOUNT_ADDRESSES,
        at_ledger_state: {
          state_version: ledgerState.ledger_state.state_version,
        },
      });
    }),
  );
});
