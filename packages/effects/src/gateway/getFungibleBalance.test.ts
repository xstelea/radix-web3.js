import { Effect, Layer } from "effect";
import { GatewayApiClientLive } from "./gatewayApiClient";
import { GetEntityDetailsServiceLive } from "./getEntityDetails";

import { GetLedgerStateLive, GetLedgerStateService } from "./getLedgerState";
import {
  GetFungibleBalanceService,
  GetFungibleBalanceLive,
} from "./getFungibleBalance";
import { EntityFungiblesPageLive } from "./entityFungiblesPage";

const gatewayApiClientLive = GatewayApiClientLive;

const getEntityDetailsServiceLive = GetEntityDetailsServiceLive.pipe(
  Layer.provide(gatewayApiClientLive)
);

const getLedgerStateLive = GetLedgerStateLive.pipe(
  Layer.provide(gatewayApiClientLive)
);

const entityFungiblesPageServiceLive = EntityFungiblesPageLive.pipe(
  Layer.provide(gatewayApiClientLive)
);

const stateEntityDetailsLive = GetFungibleBalanceLive.pipe(
  Layer.provide(getEntityDetailsServiceLive),

  Layer.provide(gatewayApiClientLive),
  Layer.provide(entityFungiblesPageServiceLive),
  Layer.provide(getLedgerStateLive)
);

const ACCOUNT_ADDRESSES = [
  "account_rdx12ydwxuv8q6j6423cx3ud2n6ghjz70n2mx9lyf2tud4ns4f8akqqdk7",
];

describe("GetFungibleBalanceService", () => {
  it("should get account balance", async () => {
    const program = Effect.provide(
      Effect.gen(function* () {
        const getFungibleBalance = yield* GetFungibleBalanceService;
        const getLedgerState = yield* GetLedgerStateService;

        const ledgerState = yield* getLedgerState({
          at_ledger_state: {
            timestamp: new Date("2025-04-31T00:00:00.000Z"),
          },
        });

        return yield* getFungibleBalance({
          addresses: ACCOUNT_ADDRESSES,
          options: {
            native_resource_details: true,
          },
          at_ledger_state: {
            state_version: ledgerState.state_version,
          },
        });
      }),
      Layer.mergeAll(
        gatewayApiClientLive,
        stateEntityDetailsLive,
        entityFungiblesPageServiceLive,
        getLedgerStateLive
      )
    );

    const result = await Effect.runPromise(
      program.pipe(
        Effect.catchAll((error) => {
          console.error(JSON.stringify(error, null, 2));
          return Effect.fail(null);
        })
      )
    );

    for (const account of result) {
      console.log(
        account.address,
        `${account.fungibleResources.length} fungible resources`
      );
    }
  });
});
