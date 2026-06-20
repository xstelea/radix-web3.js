import {
  GatewayApiClient,
  GetFungibleBalance,
  GetNonFungibleBalanceService,
} from '@radix-effects/gateway';
import { PublicKey, RadixEngineToolkit } from '@steleaio/radix-engine-toolkit';
import { ConfigProvider, Context, Data, Effect, Layer, Schema } from 'effect';

import type { Network, ResolvedRdxConfig } from './config';
import { toJsonValue } from './json';
import type {
  AccountFungiblesResult,
  AccountNftsResult,
  AccountShowResult,
  TransactionHistoryResult,
  VirtualAccountDerivation,
} from './schemas';
import { PublicKeySchema } from './schemas';

export type { VirtualAccountDerivation };

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

const gatewayConfigLayer = (
  config: Pick<ResolvedRdxConfig, 'network' | 'gatewayBaseUrl'>,
) =>
  ConfigProvider.layer(
    ConfigProvider.fromUnknown({
      NETWORK_ID: networkId(config.network),
      ...(config.gatewayBaseUrl ? { GATEWAY_URL: config.gatewayBaseUrl } : {}),
    }),
  );

const gatewayApiClientLayer = (
  config: Pick<ResolvedRdxConfig, 'network' | 'gatewayBaseUrl'>,
) => GatewayApiClient.Default.pipe(Layer.provide(gatewayConfigLayer(config)));

export const accountReadGatewayLayer = (
  config: Pick<ResolvedRdxConfig, 'network' | 'gatewayBaseUrl'>,
) => {
  const gatewayLayer = gatewayApiClientLayer(config);

  return Layer.mergeAll(
    gatewayLayer,
    GetFungibleBalance.Default.pipe(Layer.provide(gatewayLayer)),
    GetNonFungibleBalanceService.Default.pipe(Layer.provide(gatewayLayer)),
  );
};

export const getAccountFungibles = (input: {
  accountAddress: string;
  readFungibles: (accountAddress: string) => Effect.Effect<unknown, unknown>;
}): Effect.Effect<AccountFungiblesResult, unknown> =>
  input.readFungibles(input.accountAddress).pipe(
    Effect.map((result) => ({
      type: 'commandResult' as const,
      command: 'account fungibles' as const,
      result: toJsonValue(result),
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
      result: toJsonValue(result),
    })),
  );

export const gatewayAccountFungibles = (input: {
  accountAddress: string;
}): Effect.Effect<
  unknown,
  AccountReadError,
  GatewayApiClient | GetFungibleBalance
> =>
  Effect.gen(function* () {
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
    Effect.mapError(
      (reason) =>
        new AccountReadError({ accountAddress: input.accountAddress, reason }),
    ),
  );

export const gatewayAccountNfts = (input: {
  accountAddress: string;
}): Effect.Effect<
  unknown,
  AccountReadError,
  GatewayApiClient | GetNonFungibleBalanceService
> =>
  Effect.gen(function* () {
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
    Effect.mapError(
      (reason) =>
        new AccountReadError({ accountAddress: input.accountAddress, reason }),
    ),
  );

export const gatewayAccountDetails = (input: {
  accountAddress: string;
}): Effect.Effect<unknown, AccountReadError, GatewayApiClient> =>
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
    Effect.mapError(
      (reason) =>
        new AccountReadError({ accountAddress: input.accountAddress, reason }),
    ),
  );

export const gatewayAccountHistory = (input: {
  accountAddress: string;
  limit: number;
}): Effect.Effect<unknown, AccountReadError, GatewayApiClient> =>
  Effect.gen(function* () {
    const gatewayApiClient = yield* GatewayApiClient;
    return yield* gatewayApiClient.stream.innerClient.streamTransactions({
      streamTransactionsRequest: {
        limit_per_page: input.limit,
        affected_global_entities_filter: [input.accountAddress],
      },
    });
  }).pipe(
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
      result: toJsonValue(result),
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
      result: toJsonValue(result),
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
    const publicKey = yield* Schema.decodeUnknownEffect(PublicKeySchema)({
      curve: 'Ed25519',
      hex: input.publicKeyHex,
    }).pipe(
      Effect.mapError(
        () =>
          new InvalidPublicKeyError({
            code: 'INVALID_PUBLIC_KEY',
            publicKeyHex: input.publicKeyHex,
          }),
      ),
    );

    const accountAddress = yield* Effect.tryPromise(async () =>
      RadixEngineToolkit.Derive.virtualAccountAddressFromPublicKey(
        new PublicKey.Ed25519(publicKey.hex),
        networkId(input.network),
      ),
    );

    return {
      type: 'commandResult' as const,
      command: 'account derive' as const,
      network: input.network,
      derivation: 'virtualAccount' as const,
      publicKey,
      accountAddress,
    };
  });

export class AccountReadService extends Context.Service<AccountReadService>()(
  'AccountReadService',
  {
    make: Effect.succeed({
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
) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies;
}
