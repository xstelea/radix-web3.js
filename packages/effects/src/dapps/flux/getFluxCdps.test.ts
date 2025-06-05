import { describe, it } from "vitest";
import { Effect, Layer } from "effect";
import { GatewayApiClientLive } from "../../gateway/gatewayApiClient";
import { GetEntityDetailsServiceLive } from "../../gateway/getEntityDetails";
import { GetLedgerStateLive } from "../../gateway/getLedgerState";

import { EntityFungiblesPageLive } from "../../gateway/entityFungiblesPage";

import { GetFluxCdpsService, GetFluxCdpsLive } from "./getFluxCdps";
import { GetNonFungibleBalanceLive } from "../../gateway/getNonFungibleBalance";
import { EntityNonFungiblesPageLive } from "../../gateway/entityNonFungiblesPage";
import { EntityNonFungibleDataLive } from "../../gateway/entityNonFungiblesData";
import { KeyValueStoreDataLive } from "../../gateway/keyValueStoreData";
import { KeyValueStoreKeysLive } from "../../gateway/keyValueStoreKeys";

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

const entityNonFungiblesPageServiceLive = EntityNonFungiblesPageLive.pipe(
  Layer.provide(gatewayApiClientLive)
);

const entityNonFungibleDataServiceLive = EntityNonFungibleDataLive.pipe(
  Layer.provide(gatewayApiClientLive)
);

const keyValueStoreKeysServiceLive = KeyValueStoreKeysLive.pipe(
  Layer.provide(gatewayApiClientLive)
);

const keyValueStoreDataServiceLive = KeyValueStoreDataLive.pipe(
  Layer.provide(gatewayApiClientLive)
);

const getNonFungibleBalanceLive = GetNonFungibleBalanceLive.pipe(
  Layer.provide(getEntityDetailsServiceLive),
  Layer.provide(gatewayApiClientLive),
  Layer.provide(entityFungiblesPageServiceLive),
  Layer.provide(entityNonFungiblesPageServiceLive),
  Layer.provide(entityNonFungibleDataServiceLive),
  Layer.provide(getLedgerStateLive)
);

const getFluxCdpsLive = GetFluxCdpsLive.pipe(
  Layer.provide(getNonFungibleBalanceLive),
  Layer.provide(entityNonFungiblesPageServiceLive),
  Layer.provide(entityNonFungibleDataServiceLive),
  Layer.provide(keyValueStoreKeysServiceLive),
  Layer.provide(keyValueStoreDataServiceLive)
);

describe("GetFluxCdpsService", () => {
  it("should get flux CDP positions", async () => {
    const program = Effect.provide(
      Effect.gen(function* () {
        const getFluxCdps = yield* GetFluxCdpsService;

        return yield* getFluxCdps({
          accountAddresses: [
            "account_rdx12xl2meqtelz47mwp3nzd72jkwyallg5yxr9hkc75ac4qztsxulfpew",
            "account_rdx16y4gqnchvxeszcpswg2zldgsle6uqvnl0znerne70tw9535njhkgzk",
            "account_rdx168nr5dwmll4k2x5apegw5dhrpejf3xac7khjhgjqyg4qddj9tg9v4d", // random account I found on the dashboard lol
          ],
          at_ledger_state: {
            state_version: 302444078,
          },
        });
      }),
      Layer.mergeAll(
        getFluxCdpsLive,
        gatewayApiClientLive,
        getNonFungibleBalanceLive,
        entityFungiblesPageServiceLive,
        entityNonFungiblesPageServiceLive,
        entityNonFungibleDataServiceLive,
        keyValueStoreKeysServiceLive,
        keyValueStoreDataServiceLive,
        getLedgerStateLive
      )
    );

    const result = await Effect.runPromise(program);
    console.log(JSON.stringify(result, null, 2));
  });
});
