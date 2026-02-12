import { Config, Effect } from 'effect';
import { GatewayApiClient } from '../gatewayApiClient';
import { chunker } from '../helpers';
import type { AtLedgerState } from '../schemas';

export type GetEntityDetailsVaultAggregatedParameters = Parameters<
  (typeof GatewayApiClient)['Service']['state']['getEntityDetailsVaultAggregated']
>;

export type GetEntityDetailsInput =
  GetEntityDetailsVaultAggregatedParameters[0];
export type GetEntityDetailsOptions =
  GetEntityDetailsVaultAggregatedParameters[1];
export type GetEntityDetailsState =
  GetEntityDetailsVaultAggregatedParameters[2];

export class GetEntityDetailsVaultAggregated extends Effect.Service<GetEntityDetailsVaultAggregated>()(
  'GetEntityDetailsVaultAggregated',
  {
    effect: Effect.gen(function* () {
      const gatewayClient = yield* GatewayApiClient;
      const pageSize = yield* Config.number(
        'GatewayApi__Endpoint__StateEntityDetailsPageSize',
      ).pipe(Config.withDefault(20));

      return Effect.fnUntraced(function* (
        input: GetEntityDetailsInput,
        options: GetEntityDetailsOptions,
        at_ledger_state?: AtLedgerState,
      ) {
        const chunks = chunker(input, pageSize);
        return yield* Effect.forEach(
          chunks,
          Effect.fn(function* (addresses) {
            return yield* gatewayClient.state.getEntityDetailsVaultAggregated(
              addresses,
              options,
              at_ledger_state,
            );
          }),
        ).pipe(Effect.map((res) => res.flat()));
      });
    }),
  },
) {}
