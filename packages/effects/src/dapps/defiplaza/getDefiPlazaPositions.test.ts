import { Effect, Layer } from "effect";
import { GatewayApiClientLive } from "../../gateway/gatewayApiClient";
import { GetEntityDetailsServiceLive } from "../../gateway/getEntityDetails";
import { GetLedgerStateLive } from "../../gateway/getLedgerState";

import { EntityFungiblesPageLive } from "../../gateway/entityFungiblesPage";

import { GetNonFungibleBalanceLive } from "../../gateway/getNonFungibleBalance";
import { EntityNonFungiblesPageLive } from "../../gateway/entityNonFungiblesPage";
import { EntityNonFungibleDataLive } from "../../gateway/entityNonFungiblesData";
import {
	GetDefiPlazaPositionsLive,
	GetDefiPlazaPositionsService,
} from "./getDefiPlazaPositions";
import { GetFungibleBalanceLive } from "../../gateway/getFungibleBalance";
import { GetComponentStateLive } from "../../gateway/getComponentState";
import { GetKeyValueStoreLive } from "../../gateway/getKeyValueStore";
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

const getFungibleBalanceLive = GetFungibleBalanceLive.pipe(
	Layer.provide(getEntityDetailsServiceLive),
	Layer.provide(gatewayApiClientLive),
	Layer.provide(entityFungiblesPageServiceLive),
	Layer.provide(getLedgerStateLive)
);

const getNonFungibleBalanceLive = GetNonFungibleBalanceLive.pipe(
	Layer.provide(getEntityDetailsServiceLive),
	Layer.provide(gatewayApiClientLive),
	Layer.provide(entityFungiblesPageServiceLive),
	Layer.provide(entityNonFungiblesPageServiceLive),
	Layer.provide(entityNonFungibleDataServiceLive),
	Layer.provide(getLedgerStateLive)
);

const getComponentStateServiceLive = GetComponentStateLive.pipe(
	Layer.provide(getEntityDetailsServiceLive),
	Layer.provide(gatewayApiClientLive)
);

const keyValueStoreDataServiceLive = KeyValueStoreDataLive.pipe(
	Layer.provide(gatewayApiClientLive)
);

const keyValueStoreKeysServiceLive = KeyValueStoreKeysLive.pipe(
	Layer.provide(gatewayApiClientLive)
);

const getKeyValueStoreServiceLive = GetKeyValueStoreLive.pipe(
	Layer.provide(gatewayApiClientLive),
	Layer.provide(keyValueStoreDataServiceLive),
	Layer.provide(keyValueStoreKeysServiceLive)
);

const getDefiPlazaPositionsLive = GetDefiPlazaPositionsLive.pipe(
	Layer.provide(getNonFungibleBalanceLive),
	Layer.provide(entityNonFungiblesPageServiceLive),
	Layer.provide(entityFungiblesPageServiceLive),
	Layer.provide(getFungibleBalanceLive),
	Layer.provide(getEntityDetailsServiceLive),
	Layer.provide(getComponentStateServiceLive),
	Layer.provide(getKeyValueStoreServiceLive)
);

describe("GetDefiPlazaPositionsService", () => {
	it("should get weft finance positions", async () => {
		const program = Effect.provide(
			Effect.gen(function* () {
				const getDefiPlazaPositions = yield* GetDefiPlazaPositionsService;

				return yield* getDefiPlazaPositions({
					accountAddresses: [
						// contains xUSDC BaseLP tokens
						"account_rdx12x2a5dft0gszufcce98ersqvsd8qr5kzku968jd50n8w4qyl9awecr",
					],
					at_ledger_state: {
						timestamp: new Date(),
					},
				});
			}),
			Layer.mergeAll(
				getDefiPlazaPositionsLive,
				gatewayApiClientLive,
				getNonFungibleBalanceLive,
				entityFungiblesPageServiceLive,
				entityNonFungiblesPageServiceLive,
				getLedgerStateLive,
				getEntityDetailsServiceLive,
				getFungibleBalanceLive,
				getComponentStateServiceLive,
				getKeyValueStoreServiceLive,
				keyValueStoreDataServiceLive,
				keyValueStoreKeysServiceLive
			)
		);

		const result = await Effect.runPromise(program);

		console.log(JSON.stringify(result, null, 2));
	});
});
