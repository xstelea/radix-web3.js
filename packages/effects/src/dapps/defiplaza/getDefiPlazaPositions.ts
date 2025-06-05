import { Context, Effect, Layer } from "effect";

import type { GatewayApiClientService } from "../../gateway/gatewayApiClient";

import type { EntityFungiblesPageService } from "../../gateway/entityFungiblesPage";
import type { GetLedgerStateService } from "../../gateway/getLedgerState";
import type {
	EntityNotFoundError,
	GatewayError,
	InvalidInputError,
} from "../../gateway/errors";
import type { GetNonFungibleBalanceService } from "../../gateway/getNonFungibleBalance";
import type { EntityNonFungiblesPageService } from "../../gateway/entityNonFungiblesPage";

import { GetFungibleBalanceService } from "../../gateway/getFungibleBalance";

import { BigNumber } from "bignumber.js";
import {
	GetComponentStateService,
	type InvalidComponentStateError,
} from "../../gateway/getComponentState";
import { LendingPoolSchema, SingleResourcePool } from "./schemas";
import { GetKeyValueStoreService } from "../../gateway/getKeyValueStore";
import type { KeyValueStoreDataService } from "../../gateway/keyValueStoreData";
import type { KeyValueStoreKeysService } from "../../gateway/keyValueStoreKeys";
import { DefiPlaza, defiplazaFungibleRecourceAddresses } from "./constants";
import { GetEntityDetailsError } from "../../gateway/getEntityDetails";
import type { AtLedgerState } from "../../gateway/schemas";

export class FailedToParseLendingPoolSchemaError {
	readonly _tag = "FailedToParseLendingPoolSchemaError";
	constructor(readonly lendingPool: unknown) { }
}

type AssetBalance = {
	resourceAddress: ResourceAddress;
	amount: BigNumber;
};

type DefiPlazaPosition = {
	baseAsset: AssetBalance;
	quoteAsset: AssetBalance;
};

export type GetDefiPlazaPositionsOutput = {
	address: string;
	lending: DefiPlazaPosition[];
};

export class GetDefiPlazaPositionsService extends Context.Tag(
	"GetDefiPlazaPositionsService"
)<
	GetDefiPlazaPositionsService,
	(input: {
		accountAddresses: string[];
		at_ledger_state: AtLedgerState;
	}) => Effect.Effect<
		GetDefiPlazaPositionsOutput[],
		| GetEntityDetailsError
		| EntityNotFoundError
		| InvalidInputError
		| GatewayError
		| InvalidComponentStateError
		| FailedToParseLendingPoolSchemaError,
		| GetNonFungibleBalanceService
		| GatewayApiClientService
		| EntityFungiblesPageService
		| GetLedgerStateService
		| EntityNonFungiblesPageService
		| GetKeyValueStoreService
		| KeyValueStoreDataService
		| KeyValueStoreKeysService
	>
>() { }

type AccountAddress = string;
type ResourceAddress = string;

export const GetDefiPlazaPositionsLive = Layer.effect(
	GetDefiPlazaPositionsService,
	Effect.gen(function* () {
		const getFungibleBalanceService = yield* GetFungibleBalanceService;
		const gatewayClient = yield* GatewayApiClientService;

		return (input) => {
			return Effect.gen(function* () {
				const accountBalancesMap = new Map<
					AccountAddress,
					DefiPlazaPosition[]
				>();

				for (const accountAddress of input.accountAddresses) {
					accountBalancesMap.set(accountAddress, []);
				}

				const accountBalances = yield* getFungibleBalanceService({
					addresses: input.accountAddresses,
					at_ledger_state: input.at_ledger_state,
				});

				for (const accountBalance of accountBalances) {
					const fungibleResources = accountBalance.fungibleResources;
					const defiplazaFungibleResources = fungibleResources.filter((item) =>
						defiplazaFungibleRecourceAddresses.has(item.resourceAddress)
					);
					const accountAddress = accountBalance.address;

					for (const { resourceAddress, amount } of defiplazaFungibleResources) {
						// Fetch total supply of lp token
						const poolTokenResponse = yield* Effect.tryPromise({
							try: () =>
								gatewayClient.gatewayApiClient.state.innerClient.stateEntityDetails(
									{
										stateEntityDetailsRequest: {
											addresses: [resourceAddress],
											at_ledger_state: input.at_ledger_state,
											aggregation_level: "Global",
										},
									}
								),
							catch: (error) => new GetEntityDetailsError(error),
						});

						const poolTokenEntity = poolTokenResponse.items[0];
						if (
							!poolTokenEntity?.details ||
							poolTokenEntity.details.type !== "FungibleResource"
						) {
							return null;
						}

						const totalPoolTokens = new BigNumber(
							poolTokenEntity.details.total_supply
						);

						// Fetch balances of TwoResourcePool
						const poolResponse = yield* Effect.tryPromise({
							try: () =>
								gatewayClient.gatewayApiClient.state.innerClient.stateEntityDetails(
									{
										stateEntityDetailsRequest: {
											addresses: [DefiPlaza[resourceAddress].poolAddress],
											at_ledger_state: input.at_ledger_state,
											aggregation_level: "Global",
										},
									}
								),
							catch: (error) => new GetEntityDetailsError(error),
						});

						const poolEntity = poolResponse.items[0];
						if (!poolEntity?.fungible_resources?.items) {
							return null;
						}

						let baseInPool = new BigNumber(0);
						let quoteInPool = new BigNumber(0);

						for (const resource of poolEntity.fungible_resources.items) {
							if (resource.aggregation_level === "Global") {
								if (
									resource.resource_address === DefiPlaza[resourceAddress].baseResourceAddress
								) {
									baseInPool = new BigNumber(resource.amount);
								} else if (
									resource.resource_address === DefiPlaza[resourceAddress].quoteResourceAddress
								) {
									quoteInPool = new BigNumber(resource.amount);
								}
							}
						}

						const basePerPoolUnit = totalPoolTokens.gt(0)
							? baseInPool.dividedBy(totalPoolTokens)
							: new BigNumber(0);
						const quotePerPoolUnit = totalPoolTokens.gt(0)
							? quoteInPool.dividedBy(totalPoolTokens)
							: new BigNumber(0);

						const items = accountBalancesMap.get(accountAddress) ?? [];

						accountBalancesMap.set(accountAddress, [
							...items,
							{
								baseAsset: {
									resourceAddress: DefiPlaza[resourceAddress].baseResourceAddress,
									amount: basePerPoolUnit.multipliedBy(amount),
								},
								quoteAsset: {
									resourceAddress: DefiPlaza[resourceAddress].quoteResourceAddress,
									amount: quotePerPoolUnit.multipliedBy(amount),
								},
							},
						]);
					}
				}

				return Array.from(accountBalancesMap.entries()).map(
					([address, items]) => ({
						address,
						lending: items,
					})
				);
			});
		};
	})
);
