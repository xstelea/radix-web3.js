import { Context, Effect, Layer } from "effect";
import { BigNumber } from "bignumber.js";

import { GatewayApiClientService } from "../../gateway/gatewayApiClient";
import type { EntityFungiblesPageService } from "../../gateway/entityFungiblesPage";
import type { GetLedgerStateService } from "../../gateway/getLedgerState";
import type {
  EntityNotFoundError,
  GatewayError,
  InvalidInputError,
} from "../../gateway/errors";
import { GetNonFungibleBalanceService } from "../../gateway/getNonFungibleBalance";
import type { EntityNonFungiblesPageService } from "../../gateway/entityNonFungiblesPage";
import { FluxConstants } from "./constants";
import { CdpNftData } from "./schemas";
import type { SborError } from "sbor-ez-mode";
import { GetEntityDetailsError } from "../../gateway/getEntityDetails";
import type { AtLedgerState } from "../../gateway/schemas";
import { EntityNonFungibleDataService } from "../../gateway/entityNonFungiblesData";
import { KeyValueStoreDataService } from "../../gateway/keyValueStoreData";
import { KeyValueStoreKeysService } from "../../gateway/keyValueStoreKeys";

export class FluxParseSborError {
  readonly _tag = "FluxParseSborError";
  constructor(readonly error: SborError) {}
}

export class InvalidFluxReceiptItemError extends Error {
  readonly _tag = "InvalidFluxReceiptItemError";
}

export type GetFluxCdpsServiceInput = {
  accountAddresses: string[];
  at_ledger_state: AtLedgerState;
};

export type FluxCdpPosition = {
  nft: {
    resourceAddress: ResourceAddress;
    localId: string;
  };
  collateralAddress: string;
  collateralAmount: string;
  realDebt: string;
  poolDebt: string;
  collateralFusdRatio: string;
  interest: string;
  lastInterestChange: string;
  status: string;
  privilegedBorrower: string | null;
};

export type GetFluxCdpsServiceOutput = {
  items: {
    accountAddress: AccountAddress;
    cdpPositions: FluxCdpPosition[];
  }[];
};

export class GetFluxCdpsService extends Context.Tag("GetFluxCdpsService")<
  GetFluxCdpsService,
  (input: {
    accountAddresses: string[];
    at_ledger_state: AtLedgerState;
  }) => Effect.Effect<
    GetFluxCdpsServiceOutput,
    | GetEntityDetailsError
    | EntityNotFoundError
    | InvalidInputError
    | GatewayError
    | FluxParseSborError
    | InvalidFluxReceiptItemError,
    | GetNonFungibleBalanceService
    | GatewayApiClientService
    | EntityFungiblesPageService
    | GetLedgerStateService
    | EntityNonFungiblesPageService
    | EntityNonFungibleDataService
    | KeyValueStoreDataService
    | KeyValueStoreKeysService
  >
>() {}

type AccountAddress = string;
type ResourceAddress = string;

export const GetFluxCdpsLive = Layer.effect(
  GetFluxCdpsService,
  Effect.gen(function* () {
    const getNonFungibleBalanceService = yield* GetNonFungibleBalanceService;
    const entityNonFungibleDataService = yield* EntityNonFungibleDataService;
    const keyValueStoreKeysService = yield* KeyValueStoreKeysService;
    const keyValueStoreDataService = yield* KeyValueStoreDataService;

    return (input) => {
      return Effect.gen(function* () {
        const accountCdpMap = new Map<AccountAddress, FluxCdpPosition[]>();

        // First get all CDP NFT IDs for each account
        const result = yield* getNonFungibleBalanceService({
          addresses: input.accountAddresses,
          at_ledger_state: input.at_ledger_state,
          options: {
            non_fungible_include_nfids: true,
          },
        }).pipe(Effect.withSpan("getNonFungibleBalanceService"));

        // Collect all NFT IDs
        const allNftIds: string[] = [];
        const accountNftMap = new Map<string, string[]>();

        for (const account of result.items) {
          const nftIds: string[] = [];

          const fluxReceipts = account.nonFungibleResources.filter(
            (resource) =>
              resource.resourceAddress === FluxConstants.receiptResourceAddress
          );

          for (const fluxReceipt of fluxReceipts) {
            for (const fluxReceiptItem of fluxReceipt.items) {
              nftIds.push(fluxReceiptItem.id);
              allNftIds.push(fluxReceiptItem.id);
            }
          }

          accountNftMap.set(account.address, nftIds);
        }

        if (allNftIds.length === 0) {
          return {
            items: input.accountAddresses.map((address) => ({
              accountAddress: address,
              cdpPositions: [],
            })),
          };
        }

        // Get NFT data for all CDPs at specific state version
        const nftDataResults = yield* Effect.all(
          allNftIds.map((nftId) =>
            entityNonFungibleDataService({
              resource_address: FluxConstants.receiptResourceAddress,
              non_fungible_ids: [nftId],
              at_ledger_state: input.at_ledger_state,
            })
          )
        );

        // Get interest rate keys from both KVS
        const [xrdKeys, lsulpKeys] = yield* Effect.all([
          keyValueStoreKeysService({
            key_value_store_address: FluxConstants.xrdKvsAddress,
            at_ledger_state: input.at_ledger_state,
          }),
          keyValueStoreKeysService({
            key_value_store_address: FluxConstants.lsulpKvsAddress,
            at_ledger_state: input.at_ledger_state,
          }),
        ]);

        // Get interest rate data from both KVS
        const [xrdInterestData, lsulpInterestData] = yield* Effect.all([
          keyValueStoreDataService({
            key_value_store_address: FluxConstants.xrdKvsAddress,
            keys: xrdKeys.items.map((k: any) => ({
              key_json: k.key.programmatic_json,
            })),
            at_ledger_state: input.at_ledger_state,
          }),
          keyValueStoreDataService({
            key_value_store_address: FluxConstants.lsulpKvsAddress,
            keys: lsulpKeys.items.map((k: any) => ({
              key_json: k.key.programmatic_json,
            })),
            at_ledger_state: input.at_ledger_state,
          }),
        ]);

        // Process CDP data
        const cdps: FluxCdpPosition[] = [];

        for (let i = 0; i < allNftIds.length; i++) {
          const nftId = allNftIds[i];
          const nftData = nftDataResults[i];

          if (!nftData.non_fungible_ids[0]?.data?.programmatic_json) continue;

          const parsed = CdpNftData.safeParse(
            nftData.non_fungible_ids[0].data.programmatic_json
          );

          if (parsed.isErr()) {
            continue; // Skip invalid data
          }

          const cdpNftData = parsed.value;
          const interestRate = new BigNumber(cdpNftData.interest);
          const poolDebt = new BigNumber(cdpNftData.pool_debt);
          const collateralAddress = cdpNftData.collateral_address;

          // Find matching interest rate info
          const interestData =
            collateralAddress ===
            FluxConstants.collaterals.xrd.collateralAddress
              ? xrdInterestData.entries
              : lsulpInterestData.entries;

          const interestInfo = interestData.find((entry: any) => {
            const nodeData = entry.value.programmatic_json;
            return (
              nodeData &&
              nodeData.kind === "Tuple" &&
              new BigNumber(nodeData.fields[0].value).isEqualTo(interestRate)
            );
          });

          let realDebt = poolDebt;
          if (interestInfo) {
            const nodeData = interestInfo.value.programmatic_json;
            if (nodeData.kind === "Tuple") {
              const tupleFields = nodeData.fields;
              if (tupleFields[1] && tupleFields[1].kind === "Tuple") {
                const innerFields = tupleFields[1].fields;
                if (
                  innerFields[0].kind === "Decimal" &&
                  innerFields[1].kind === "Decimal"
                ) {
                  const totalPoolDebt = new BigNumber(innerFields[0].value);
                  const realDebtValue = new BigNumber(innerFields[1].value);
                  realDebt = realDebtValue
                    .dividedBy(totalPoolDebt)
                    .multipliedBy(poolDebt);
                }
              }
            }
          }

          const privilegedBorrower =
            cdpNftData.privileged_borrower.variant === "Some"
              ? cdpNftData.privileged_borrower.value
              : null;

          cdps.push({
            nft: {
              resourceAddress: FluxConstants.receiptResourceAddress,
              localId: nftId,
            },
            collateralAddress: cdpNftData.collateral_address,
            collateralAmount: cdpNftData.collateral_amount,
            poolDebt: cdpNftData.pool_debt,
            realDebt: realDebt.toString(),
            collateralFusdRatio: cdpNftData.collateral_fusd_ratio,
            interest: cdpNftData.interest,
            lastInterestChange: cdpNftData.last_interest_change.toString(),
            status: cdpNftData.status.variant,
            privilegedBorrower,
          });
        }

        // Map CDPs back to accounts
        for (const [accountAddress, nftIds] of accountNftMap.entries()) {
          const accountCdps = cdps.filter((cdp) =>
            nftIds.includes(cdp.nft.localId)
          );
          accountCdpMap.set(accountAddress, accountCdps);
        }

        const items = Array.from(accountCdpMap.entries()).map(
          ([accountAddress, value]) => ({
            accountAddress,
            cdpPositions: value,
          })
        );

        return {
          items,
        };
      });
    };
  })
);
