import { Data, Effect } from 'effect';
import type { ResolvedRdxConfig } from './config';

export type AccountFungibleBalance = {
  resourceAddress: string;
  amount: string;
  symbol?: string;
  name?: string;
};

export type AccountNonFungibleBalance = {
  resourceAddress: string;
  count: number;
};

export type AccountBalance = {
  accountAddress: string;
  fungibleResources: AccountFungibleBalance[];
  nonFungibleResources: AccountNonFungibleBalance[];
};

export type AccountDetails = {
  accountAddress: string;
  details: unknown;
};

export type AccountTransactionHistory = {
  accountAddress: string;
  transactions: {
    transactionId: string;
    status: string;
    confirmedAt: string | null;
  }[];
};

export class AccountReadError extends Data.TaggedError('AccountReadError')<{
  accountAddress: string;
  reason: unknown;
}> {}

const gatewayBaseUrl = (network: ResolvedRdxConfig['network']) =>
  network === 'stokenet'
    ? 'https://stokenet.radixdlt.com'
    : 'https://mainnet.radixdlt.com';

export const gatewayAccountBalance = (input: {
  config: Pick<ResolvedRdxConfig, 'network' | 'gatewayBaseUrl'>;
  accountAddress: string;
}): Effect.Effect<AccountBalance, AccountReadError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(
        `${input.config.gatewayBaseUrl ?? gatewayBaseUrl(input.config.network)}/state/entity/details`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            addresses: [input.accountAddress],
            aggregation_level: 'Global',
            opt_ins: {
              explicit_metadata: ['name', 'symbol'],
              non_fungible_include_nfids: true,
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Gateway returned ${response.status}`);
      }

      const body = (await response.json()) as {
        items?: Array<{
          fungible_resources?: {
            items?: Array<{
              resource_address: string;
              amount?: string;
              explicit_metadata?: {
                items?: Array<{
                  key: string;
                  value?: { typed?: { type?: string; value?: string } };
                }>;
              };
            }>;
          };
          non_fungible_resources?: {
            items?: Array<{
              resource_address: string;
              amount?: string | number;
            }>;
          };
        }>;
      };
      const item = body.items?.[0];
      const metadataString = (
        metadata:
          | {
              items?: Array<{
                key: string;
                value?: { typed?: { type?: string; value?: string } };
              }>;
            }
          | undefined,
        key: string,
      ) =>
        metadata?.items?.find((entry) => entry.key === key)?.value?.typed
          ?.value;

      return {
        accountAddress: input.accountAddress,
        fungibleResources:
          item?.fungible_resources?.items?.map((resource) => ({
            resourceAddress: resource.resource_address,
            amount: resource.amount ?? '0',
            symbol: metadataString(resource.explicit_metadata, 'symbol'),
            name: metadataString(resource.explicit_metadata, 'name'),
          })) ?? [],
        nonFungibleResources:
          item?.non_fungible_resources?.items?.map((resource) => ({
            resourceAddress: resource.resource_address,
            count: Number(resource.amount ?? 0),
          })) ?? [],
      };
    },
    catch: (reason) =>
      new AccountReadError({ accountAddress: input.accountAddress, reason }),
  });

export const gatewayAccountDetails = (input: {
  config: Pick<ResolvedRdxConfig, 'network' | 'gatewayBaseUrl'>;
  accountAddress: string;
}): Effect.Effect<AccountDetails, AccountReadError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(
        `${input.config.gatewayBaseUrl ?? gatewayBaseUrl(input.config.network)}/state/entity/details`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            addresses: [input.accountAddress],
            aggregation_level: 'Vault',
            opt_ins: {
              explicit_metadata: ['name', 'description'],
              ancestor_identities: true,
              component_royalty_config: true,
              package_royalty_vault_balance: true,
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Gateway returned ${response.status}`);
      }

      const body = (await response.json()) as { items?: unknown[] };

      return {
        accountAddress: input.accountAddress,
        details: body.items?.[0] ?? null,
      };
    },
    catch: (reason) =>
      new AccountReadError({ accountAddress: input.accountAddress, reason }),
  });

export const gatewayAccountHistory = (input: {
  config: Pick<ResolvedRdxConfig, 'network' | 'gatewayBaseUrl'>;
  accountAddress: string;
  limit: number;
}): Effect.Effect<AccountTransactionHistory, AccountReadError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(
        `${input.config.gatewayBaseUrl ?? gatewayBaseUrl(input.config.network)}/stream/transactions`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            limit_per_page: input.limit,
            affected_global_entities_filter: [input.accountAddress],
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Gateway returned ${response.status}`);
      }

      const body = (await response.json()) as {
        items?: Array<{
          intent_hash?: string;
          transaction_status?: string;
          confirmed_at?: string;
        }>;
      };

      return {
        accountAddress: input.accountAddress,
        transactions:
          body.items?.map((transaction) => ({
            transactionId: transaction.intent_hash ?? '',
            status: transaction.transaction_status ?? 'Unknown',
            confirmedAt: transaction.confirmed_at ?? null,
          })) ?? [],
      };
    },
    catch: (reason) =>
      new AccountReadError({ accountAddress: input.accountAddress, reason }),
  });

export const getAccountBalance = (input: {
  accountAddress: string;
  readBalance: (
    accountAddress: string,
  ) => Effect.Effect<AccountBalance, unknown>;
}) =>
  input.readBalance(input.accountAddress).pipe(
    Effect.map((balance) => ({
      type: 'commandResult' as const,
      command: 'account balance' as const,
      ...balance,
    })),
  );

export const getAccountDetails = (input: {
  accountAddress: string;
  readDetails: (
    accountAddress: string,
  ) => Effect.Effect<AccountDetails, unknown>;
}) =>
  input.readDetails(input.accountAddress).pipe(
    Effect.map((details) => ({
      type: 'commandResult' as const,
      command: 'account show' as const,
      ...details,
    })),
  );

export const getAccountTransactionHistory = (input: {
  accountAddress: string;
  limit: number;
  readHistory: (
    accountAddress: string,
    limit: number,
  ) => Effect.Effect<AccountTransactionHistory, unknown>;
}) =>
  input.readHistory(input.accountAddress, input.limit).pipe(
    Effect.map((history) => ({
      type: 'commandResult' as const,
      command: 'tx history' as const,
      ...history,
    })),
  );

export class AccountReadService extends Effect.Service<AccountReadService>()(
  'AccountReadService',
  {
    sync: () => ({
      getAccountBalance,
      getAccountDetails,
      getAccountTransactionHistory,
      gatewayAccountBalance,
      gatewayAccountDetails,
      gatewayAccountHistory,
    }),
  },
) {}
