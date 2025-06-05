import { describe, it } from "vitest";
import { Effect, Layer } from "effect";

import { GatewayApiClientLive } from "../../gateway/gatewayApiClient";
import { GetEntityDetailsServiceLive } from "../../gateway/getEntityDetails";
import {
  GetLedgerStateLive,
  GetLedgerStateService,
} from "../../gateway/getLedgerState";
import { GetFungibleBalanceLive } from "../../gateway/getFungibleBalance";
import { EntityFungiblesPageLive } from "../../gateway/entityFungiblesPage";
import {
  GetFluxReservoirLive,
  GetFluxReservoirService,
} from "./getFluxReservoir";

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

const getFungibleBalanceLive = GetFungibleBalanceLive.pipe(
  Layer.provide(getEntityDetailsServiceLive),
  Layer.provide(gatewayApiClientLive),
  Layer.provide(entityFungiblesPageServiceLive),
  Layer.provide(getLedgerStateLive)
);

const getFluxReservoirLive = GetFluxReservoirLive.pipe(
  Layer.provide(getFungibleBalanceLive),
  Layer.provide(gatewayApiClientLive),
  Layer.provide(getLedgerStateLive)
);

describe("GetFluxReservoirService", () => {
  it("should get flux reservoir positions", async () => {
    const program = Effect.provide(
      Effect.gen(function* () {
        const getFluxReservoir = yield* GetFluxReservoirService;
        const getLedgerState = yield* GetLedgerStateService;

        const state = yield* getLedgerState({
          at_ledger_state: {
            timestamp: new Date(),
          },
        });

        console.log(JSON.stringify(state, null, 2));

        return yield* getFluxReservoir({
          accountAddresses: [
            "account_rdx12xl2meqtelz47mwp3nzd72jkwyallg5yxr9hkc75ac4qztsxulfpew",
            "account_rdx16y4gqnchvxeszcpswg2zldgsle6uqvnl0znerne70tw9535njhkgzk",
            "account_rdx168nr5dwmll4k2x5apegw5dhrpejf3xac7khjhgjqyg4qddj9tg9v4d", // random account I found on the dashboard lol
          ],
          at_ledger_state: {
            state_version: state.state_version,
          },
        });
      }),
      Layer.mergeAll(
        gatewayApiClientLive,
        getFungibleBalanceLive,
        entityFungiblesPageServiceLive,
        getLedgerStateLive,
        getFluxReservoirLive
      )
    );

    const result = await Effect.runPromise(program);

    console.log(JSON.stringify(result, null, 2));
  });
});
