import { it } from '@effect/vitest';
import { Effect } from 'effect';
import { describe, expect } from 'vitest';
import {
  getAccountBalance,
  getAccountDetails,
  getAccountTransactionHistory,
} from './accountReads';

describe('account read workflows', () => {
  it.effect('reads account balances without signatures', () =>
    Effect.gen(function* () {
      const result = yield* getAccountBalance({
        accountAddress: 'account_rdx1...',
        readBalance: (accountAddress) =>
          Effect.succeed({
            accountAddress,
            fungibleResources: [
              {
                resourceAddress: 'resource_rdx1xrd',
                amount: '10',
                symbol: 'XRD',
                name: 'Radix',
              },
            ],
            nonFungibleResources: [],
          }),
      });

      expect(result).toMatchObject({
        type: 'commandResult',
        command: 'account balance',
        accountAddress: 'account_rdx1...',
        fungibleResources: [{ amount: '10' }],
      });
    }),
  );

  it.effect('reads account details without signatures', () =>
    Effect.gen(function* () {
      const result = yield* getAccountDetails({
        accountAddress: 'account_rdx1...',
        readDetails: (accountAddress) =>
          Effect.succeed({
            accountAddress,
            details: {
              address: accountAddress,
              metadata: { name: 'Treasury' },
            },
          }),
      });

      expect(result).toMatchObject({
        type: 'commandResult',
        command: 'account show',
        accountAddress: 'account_rdx1...',
        details: {
          metadata: { name: 'Treasury' },
        },
      });
    }),
  );

  it.effect('reads account-scoped transaction history without signatures', () =>
    Effect.gen(function* () {
      const result = yield* getAccountTransactionHistory({
        accountAddress: 'account_rdx1...',
        limit: 1,
        readHistory: (accountAddress, limit) =>
          Effect.succeed({
            accountAddress,
            transactions: [
              {
                transactionId: 'txid_1',
                status: 'CommittedSuccess',
                confirmedAt: '2026-05-15T00:00:00.000Z',
              },
            ].slice(0, limit),
          }),
      });

      expect(result).toMatchObject({
        type: 'commandResult',
        command: 'tx history',
        transactions: [{ transactionId: 'txid_1' }],
      });
    }),
  );
});
