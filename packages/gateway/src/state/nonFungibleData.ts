import type { NonFungibleDataRequest } from '@radixdlt/babylon-gateway-api-sdk';
import { Config, Context, Effect, Layer } from 'effect';

import { GatewayApiClient } from '../gatewayApiClient';
import { chunker } from '../helpers/chunker';
import type { AtLedgerState } from '../schemas';

export class NonFungibleData extends Context.Service<NonFungibleData>()(
  'NonFungibleData',
  {
    make: Effect.gen(function* () {
      const gatewayClient = yield* GatewayApiClient;
      const pageSize = yield* Config.number(
        'GatewayApi__Endpoint__MaxPageSize',
      ).pipe(Config.withDefault(100));

      return Effect.fn('NonFungibleData')(function* (
        input: Omit<
          NonFungibleDataRequest['stateNonFungibleDataRequest'],
          'at_ledger_state'
        > & {
          at_ledger_state?: AtLedgerState;
        },
      ) {
        const chunks = chunker(input.non_fungible_ids, pageSize);
        return yield* Effect.forEach(
          chunks,
          Effect.fn('NonFungibleData.getChunk')(function* (chunk) {
            return yield* gatewayClient.state.innerClient.nonFungibleData({
              stateNonFungibleDataRequest: {
                ...input,
                non_fungible_ids: chunk,
              },
            });
          }),
        ).pipe(
          Effect.map((res) => {
            const non_fungible_ids = res.flatMap(
              (item) => item.non_fungible_ids,
            );

            return non_fungible_ids;
          }),
        );
      });
    }),
  },
) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(GatewayApiClient.Default),
  );
}
