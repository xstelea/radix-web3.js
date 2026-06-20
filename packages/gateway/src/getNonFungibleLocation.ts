import { Config, Context, Effect, Layer } from 'effect';

import { GatewayApiClient } from './gatewayApiClient';
import { chunker } from './helpers';
import type { AtLedgerState } from './schemas';

export class GetNonFungibleLocationService extends Context.Service<GetNonFungibleLocationService>()(
  'GetNonFungibleLocationService',
  {
    make: Effect.gen(function* () {
      const gatewayClient = yield* GatewayApiClient;
      const pageSize = yield* Config.number(
        'GatewayApi__Endpoint__MaxPageSize',
      ).pipe(Config.withDefault(100));
      return Effect.fn(function* (input: {
        resourceAddress: string;
        nonFungibleIds: string[];
        at_ledger_state?: AtLedgerState;
      }) {
        const chunks = chunker(input.nonFungibleIds, pageSize);
        return yield* Effect.forEach(
          chunks,
          Effect.fn(function* (nonFungibleIds) {
            return yield* gatewayClient.state.innerClient.nonFungibleLocation({
              stateNonFungibleLocationRequest: {
                non_fungible_ids: nonFungibleIds,
                resource_address: input.resourceAddress,
                at_ledger_state: input.at_ledger_state,
              },
            });
          }),
        ).pipe(Effect.map((res) => res.flat()));
      });
    }),
  },
) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(GatewayApiClient.Default),
  );
}
