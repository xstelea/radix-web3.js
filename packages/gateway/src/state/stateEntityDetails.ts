import { Config, Context, Effect, Layer } from 'effect';

import { GatewayApiClient } from '../gatewayApiClient';
import { chunker } from '../helpers/chunker';

export type StateEntityDetailsParameters = Parameters<
  (typeof GatewayApiClient)['Service']['state']['innerClient']['stateEntityDetails']
>;

export type StateEntityDetailsInput =
  StateEntityDetailsParameters[0]['stateEntityDetailsRequest'];

export class StateEntityDetails extends Context.Service<StateEntityDetails>()(
  'StateEntityDetails',
  {
    make: Effect.gen(function* () {
      const gatewayClient = yield* GatewayApiClient;

      const pageSize = yield* Config.number(
        'GatewayApi__Endpoint__StateEntityDetailsPageSize',
      ).pipe(Config.withDefault(20));

      const concurrency = yield* Config.number(
        'GATEWAY_STATE_ENTITY_DETAILS_CONCURRENCY',
      ).pipe(Config.withDefault(5));

      return Effect.fn('StateEntityDetails')(function* (
        input: StateEntityDetailsInput,
      ) {
        const chunks = chunker(input.addresses, pageSize);

        const result = yield* Effect.forEach(
          chunks,
          Effect.fn('StateEntityDetails.getChunk')(function* (addresses) {
            return yield* gatewayClient.state.innerClient.stateEntityDetails({
              stateEntityDetailsRequest: { ...input, addresses },
            });
          }),
          { concurrency },
        ).pipe(
          Effect.map((res) => {
            const ledger_state = res[0].ledger_state;
            const items = res.flatMap((item) => item.items);

            return {
              ledger_state,
              items,
            };
          }),
        );

        return result;
      });
    }),
  },
) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(GatewayApiClient.Default),
  );
}
