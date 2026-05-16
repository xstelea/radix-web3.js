import {
  GatewayApiClient,
  GetFungibleBalance,
  GetNonFungibleBalanceService,
} from '@radix-effects/gateway';
import { PublicKey, RadixEngineToolkit } from '@steleaio/radix-engine-toolkit';
import { ConfigProvider, Data, Effect, Layer } from 'effect';
import type { Network, ResolvedRdxConfig } from './config';
import type {
  AccountFungiblesResult,
  AccountNftsResult,
  AccountShowResult,
  TransactionHistoryResult,
} from './schemas';

export type VirtualAccountDerivation = {
  network: Network;
  derivation: 'virtualAccount';
  publicKey: { curve: 'Ed25519'; hex: string };
  accountAddress: string;
};

export class AccountReadError extends Data.TaggedError('AccountReadError')<{
  accountAddress: string;
  reason: unknown;
}> {}

export class InvalidPublicKeyError extends Data.TaggedError(
  'InvalidPublicKeyError',
)<{
  code: 'INVALID_PUBLIC_KEY';
  publicKeyHex: string;
}> {}

const networkId = (network: Network) => (network === 'stokenet' ? 2 : 1);
const isEd25519PublicKeyHex = (value: string) =>
  /^[0-9a-fA-F]{64}$/.test(value);

const gatewayConfigLayer = (
  config: Pick<ResolvedRdxConfig, 'network' | 'gatewayBaseUrl'>,
) =>
  Layer.setConfigProvider(
    ConfigProvider.fromJson({
      NETWORK_ID: networkId(config.network),
      ...(config.gatewayBaseUrl ? { GATEWAY_URL: config.gatewayBaseUrl } : {}),
    }),
  );

const gatewayApiClientLayer = (
  config: Pick<ResolvedRdxConfig, 'network' | 'gatewayBaseUrl'>,
) => GatewayApiClient.Default.pipe(Layer.provide(gatewayConfigLayer(config)));

const isBigNumberLike = (
  value: unknown,
): value is { toString: () => string; isBigNumber?: boolean } =>
  typeof value === 'object' &&
  value !== null &&
  'isBigNumber' in value &&
  typeof (value as { toString?: unknown }).toString === 'function';

const toJsonSafe = (value: unknown): unknown => {
  if (isBigNumberLike(value)) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(toJsonSafe);
  }

  if (typeof value === 'object' && value !== null) {
    if (typeof (value as { toJSON?: unknown }).toJSON === 'function') {
      return (value as { toJSON: () => unknown }).toJSON();
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, toJsonSafe(entry)]),
    );
  }

  return value;
};

export const getAccountFungibles = (input: {
  accountAddress: string;
  readFungibles: (accountAddress: string) => Effect.Effect<unknown, unknown>;
}): Effect.Effect<AccountFungiblesResult, unknown> =>
  input.readFungibles(input.accountAddress).pipe(
    Effect.map((result) => ({
      type: 'commandResult' as const,
      command: 'account fungibles' as const,
      result: toJsonSafe(result),
    })),
  );

export const getAccountNfts = (input: {
  accountAddress: string;
  readNfts: (accountAddress: string) => Effect.Effect<unknown, unknown>;
}): Effect.Effect<AccountNftsResult, unknown> =>
  input.readNfts(input.accountAddress).pipe(
    Effect.map((result) => ({
      type: 'commandResult' as const,
      command: 'account nfts' as const,
      result: toJsonSafe(result),
    })),
  );

export const gatewayAccountFungibles = (input: {
  config: Pick<ResolvedRdxConfig, 'network' | 'gatewayBaseUrl'>;
  accountAddress: string;
}): Effect.Effect<unknown, AccountReadError> => {
  const gatewayLayer = gatewayApiClientLayer(input.config);
  const accountFungiblesLayer = Layer.merge(
    gatewayLayer,
    GetFungibleBalance.Default.pipe(Layer.provide(gatewayLayer)),
  );

  return Effect.gen(function* () {
    const gatewayApiClient = yield* GatewayApiClient;
    const status = yield* gatewayApiClient.status.getCurrent();
    const getFungibleBalance = yield* GetFungibleBalance;
    return yield* getFungibleBalance({
      addresses: [input.accountAddress],
      at_ledger_state: {
        state_version: status.ledger_state.state_version,
      },
      options: { explicit_metadata: ['name', 'symbol'] },
    });
  }).pipe(
    Effect.provide(accountFungiblesLayer),
    Effect.mapError(
      (reason) =>
        new AccountReadError({ accountAddress: input.accountAddress, reason }),
    ),
  );
};

export const gatewayAccountNfts = (input: {
  config: Pick<ResolvedRdxConfig, 'network' | 'gatewayBaseUrl'>;
  accountAddress: string;
}): Effect.Effect<unknown, AccountReadError> => {
  const gatewayLayer = gatewayApiClientLayer(input.config);
  const accountNftsLayer = Layer.merge(
    gatewayLayer,
    GetNonFungibleBalanceService.Default.pipe(Layer.provide(gatewayLayer)),
  );

  return Effect.gen(function* () {
    const gatewayApiClient = yield* GatewayApiClient;
    const status = yield* gatewayApiClient.status.getCurrent();
    const getNonFungibleBalance = yield* GetNonFungibleBalanceService;
    return yield* getNonFungibleBalance({
      addresses: [input.accountAddress],
      at_ledger_state: {
        state_version: status.ledger_state.state_version,
      },
    });
  }).pipe(
    Effect.provide(accountNftsLayer),
    Effect.mapError(
      (reason) =>
        new AccountReadError({ accountAddress: input.accountAddress, reason }),
    ),
  );
};

export const gatewayAccountDetails = (input: {
  config: Pick<ResolvedRdxConfig, 'network' | 'gatewayBaseUrl'>;
  accountAddress: string;
}): Effect.Effect<unknown, AccountReadError> =>
  Effect.gen(function* () {
    const gatewayApiClient = yield* GatewayApiClient;
    return yield* gatewayApiClient.state.innerClient.stateEntityDetails({
      stateEntityDetailsRequest: {
        addresses: [input.accountAddress],
        aggregation_level: 'Vault',
        opt_ins: {
          explicit_metadata: ['name', 'description'],
          ancestor_identities: true,
          component_royalty_config: true,
          package_royalty_vault_balance: true,
        },
      },
    });
  }).pipe(
    Effect.provide(gatewayApiClientLayer(input.config)),
    Effect.mapError(
      (reason) =>
        new AccountReadError({ accountAddress: input.accountAddress, reason }),
    ),
  );

export const gatewayAccountHistory = (input: {
  config: Pick<ResolvedRdxConfig, 'network' | 'gatewayBaseUrl'>;
  accountAddress: string;
  limit: number;
}): Effect.Effect<unknown, AccountReadError> =>
  Effect.gen(function* () {
    const gatewayApiClient = yield* GatewayApiClient;
    return yield* gatewayApiClient.stream.innerClient.streamTransactions({
      streamTransactionsRequest: {
        limit_per_page: input.limit,
        affected_global_entities_filter: [input.accountAddress],
      },
    });
  }).pipe(
    Effect.provide(gatewayApiClientLayer(input.config)),
    Effect.mapError(
      (reason) =>
        new AccountReadError({ accountAddress: input.accountAddress, reason }),
    ),
  );

export const getAccountDetails = (input: {
  accountAddress: string;
  readDetails: (accountAddress: string) => Effect.Effect<unknown, unknown>;
}): Effect.Effect<AccountShowResult, unknown> =>
  input.readDetails(input.accountAddress).pipe(
    Effect.map((result) => ({
      type: 'commandResult' as const,
      command: 'account show' as const,
      result: toJsonSafe(result),
    })),
  );

export const getAccountTransactionHistory = (input: {
  accountAddress: string;
  limit: number;
  readHistory: (
    accountAddress: string,
    limit: number,
  ) => Effect.Effect<unknown, unknown>;
}): Effect.Effect<TransactionHistoryResult, unknown> =>
  input.readHistory(input.accountAddress, input.limit).pipe(
    Effect.map((result) => ({
      type: 'commandResult' as const,
      command: 'tx history' as const,
      result: toJsonSafe(result),
    })),
  );

export const deriveVirtualAccountAddress = (input: {
  network: Network;
  publicKeyHex: string;
}): Effect.Effect<
  {
    type: 'commandResult';
    command: 'account derive';
  } & VirtualAccountDerivation,
  unknown
> =>
  Effect.gen(function* () {
    if (!isEd25519PublicKeyHex(input.publicKeyHex)) {
      return yield* Effect.fail(
        new InvalidPublicKeyError({
          code: 'INVALID_PUBLIC_KEY',
          publicKeyHex: input.publicKeyHex,
        }),
      );
    }

    return yield* Effect.tryPromise(async () =>
      RadixEngineToolkit.Derive.virtualAccountAddressFromPublicKey(
        new PublicKey.Ed25519(input.publicKeyHex),
        networkId(input.network),
      ),
    );
  }).pipe(
    Effect.map((accountAddress) => ({
      type: 'commandResult' as const,
      command: 'account derive' as const,
      network: input.network,
      derivation: 'virtualAccount' as const,
      publicKey: { curve: 'Ed25519' as const, hex: input.publicKeyHex },
      accountAddress,
    })),
  );

export class AccountReadService extends Effect.Service<AccountReadService>()(
  'AccountReadService',
  {
    sync: () => ({
      getAccountDetails,
      getAccountFungibles,
      getAccountNfts,
      getAccountTransactionHistory,
      deriveVirtualAccountAddress,
      gatewayAccountDetails,
      gatewayAccountFungibles,
      gatewayAccountHistory,
      gatewayAccountNfts,
    }),
  },
) {}
