import { Effect, Layer } from "effect";
import { GatewayApiClientLive } from "../gateway/gatewayApiClient";
import { GetEntityDetailsServiceLive } from "../gateway/getEntityDetails";
import { GetLedgerStateLive } from "../gateway/getLedgerState";
import { GetFungibleBalanceLive } from "../gateway/getFungibleBalance";
import { EntityFungiblesPageLive } from "../gateway/entityFungiblesPage";
import {
  GetUserStakingPositionsLive,
  GetUserStakingPositionsService,
} from "./getUserStakingPositions";
import { EntityNonFungiblesPageLive } from "../gateway/entityNonFungiblesPage";
import { EntityNonFungibleDataLive } from "../gateway/entityNonFungiblesData";
import { GetNonFungibleBalanceLive } from "../gateway/getNonFungibleBalance";
import { GetAllValidatorsLive } from "../gateway/getAllValidators";

const gatewayApiClientLive = GatewayApiClientLive;

const getEntityDetailsServiceLive = GetEntityDetailsServiceLive.pipe(
  Layer.provide(gatewayApiClientLive)
);

const getLedgerStateLive = GetLedgerStateLive.pipe(
  Layer.provide(gatewayApiClientLive)
);

const getAllValidatorsServiceLive = GetAllValidatorsLive.pipe(
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

const entityNonFungiblesPageServiceLive = EntityNonFungiblesPageLive.pipe(
  Layer.provide(gatewayApiClientLive)
);

const entityNonFungibleDataServiceLive = EntityNonFungibleDataLive.pipe(
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

const getUserStakingPositionsLive = GetUserStakingPositionsLive.pipe(
  Layer.provide(gatewayApiClientLive),
  Layer.provide(stateEntityDetailsLive),
  Layer.provide(entityFungiblesPageServiceLive),
  Layer.provide(getLedgerStateLive),
  Layer.provide(entityNonFungiblesPageServiceLive),
  Layer.provide(entityNonFungibleDataServiceLive),
  Layer.provide(getNonFungibleBalanceLive),
  Layer.provide(getAllValidatorsServiceLive)
);

describe("getUserStakingPositions", () => {
  it("should get user staking positions", async () => {
    const result = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const getUserStakingPositionsService =
            yield* GetUserStakingPositionsService;

          return yield* getUserStakingPositionsService({
            addresses: [],
            at_ledger_state: {
              state_version: 283478629,
            },
          });
        }),
        Layer.mergeAll(
          gatewayApiClientLive,
          stateEntityDetailsLive,
          entityFungiblesPageServiceLive,
          getLedgerStateLive,
          entityNonFungiblesPageServiceLive,
          entityNonFungibleDataServiceLive,
          getNonFungibleBalanceLive,
          getAllValidatorsServiceLive,
          getUserStakingPositionsLive
        )
      )
    );

    console.log(JSON.stringify(result, null, 2));
  }, 60_000);
});
