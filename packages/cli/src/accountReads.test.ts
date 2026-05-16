import { it } from '@effect/vitest';
import { Effect } from 'effect';
import { describe, expect } from 'vitest';
import {
  getAccountFungibles,
  getAccountNfts,
  getAccountDetails,
  getAccountTransactionHistory,
} from './accountReads';

describe('account read workflows', () => {
  it.effect('reads account fungibles as Gateway-shaped JSON-safe results', () =>
    Effect.gen(function* () {
      const result = yield* getAccountFungibles({
        accountAddress: 'account_rdx1...',
        readFungibles: (accountAddress) =>
          Effect.succeed([
            {
              address: accountAddress,
              items: [
                {
                  resource_address: 'resource_rdx1xrd',
                  amount: { isBigNumber: true, toString: () => '10' },
                  explicit_metadata: { items: [] },
                  last_updated_at_state_version: 1,
                },
              ],
            },
          ]),
      });

      expect(result).toEqual({
        type: 'commandResult',
        command: 'account fungibles',
        result: [
          {
            address: 'account_rdx1...',
            items: [
              {
                resource_address: 'resource_rdx1xrd',
                amount: '10',
                explicit_metadata: { items: [] },
                last_updated_at_state_version: 1,
              },
            ],
          },
        ],
      });
    }),
  );

  it.effect('reads account nfts as Gateway-shaped command results', () =>
    Effect.gen(function* () {
      const result = yield* getAccountNfts({
        accountAddress: 'account_rdx1...',
        readNfts: (accountAddress) =>
          Effect.succeed({
            items: [
              {
                address: accountAddress,
                nonFungibleResources: [
                  {
                    resourceAddress: 'resource_rdx1nft',
                    items: [{ id: '#1#', isBurned: false }],
                  },
                ],
              },
            ],
          }),
      });

      expect(result).toEqual({
        type: 'commandResult',
        command: 'account nfts',
        result: {
          items: [
            {
              address: 'account_rdx1...',
              nonFungibleResources: [
                {
                  resourceAddress: 'resource_rdx1nft',
                  items: [{ id: '#1#', isBurned: false }],
                },
              ],
            },
          ],
        },
      });
    }),
  );

  it.effect('reads account details as Gateway-shaped command results', () =>
    Effect.gen(function* () {
      const result = yield* getAccountDetails({
        accountAddress: 'account_rdx1...',
        readDetails: (accountAddress) =>
          Effect.succeed({
            ledger_state: { state_version: 1 },
            items: [
              { address: accountAddress, metadata: { name: 'Treasury' } },
            ],
          }),
      });

      expect(result).toEqual({
        type: 'commandResult',
        command: 'account show',
        result: {
          ledger_state: { state_version: 1 },
          items: [
            {
              address: 'account_rdx1...',
              metadata: { name: 'Treasury' },
            },
          ],
        },
      });
    }),
  );

  it.effect('reads transaction history as Gateway-shaped command results', () =>
    Effect.gen(function* () {
      const result = yield* getAccountTransactionHistory({
        accountAddress: 'account_rdx1...',
        limit: 1,
        readHistory: (accountAddress, limit) =>
          Effect.succeed({
            ledger_state: { state_version: 2 },
            items: [
              {
                intent_hash: 'txid_1',
                transaction_status: 'CommittedSuccess',
                confirmed_at: '2026-05-15T00:00:00.000Z',
                affected_global_entities: [accountAddress],
              },
            ].slice(0, limit),
          }),
      });

      expect(result).toEqual({
        type: 'commandResult',
        command: 'tx history',
        result: {
          ledger_state: { state_version: 2 },
          items: [
            {
              intent_hash: 'txid_1',
              transaction_status: 'CommittedSuccess',
              confirmed_at: '2026-05-15T00:00:00.000Z',
              affected_global_entities: ['account_rdx1...'],
            },
          ],
        },
      });
    }),
  );
});
