import type { NonFungibleDataRequest } from '@radixdlt/babylon-gateway-api-sdk';
import { Config, Effect } from 'effect';
import { GatewayApiClient } from '../gatewayApiClient';
import { chunker } from '../helpers/chunker';
import type { AtLedgerState } from '../schemas';

export class NonFungibleData extends Effect.Service<NonFungibleData>()(
  'NonFungibleData',
  {
    effect: Effect.gen(function* () {
      const gatewayClient = yield* GatewayApiClient;
      const pageSize = yield* Config.number(
        'GatewayApi__Endpoint__MaxPageSize',
      ).pipe(Config.withDefault(100));

      return Effect.fnUntraced(function* (
        input: Omit<
          NonFungibleDataRequest['stateNonFungibleDataRequest'],
          'at_ledger_state'
        > & {
          at_ledger_state: AtLedgerState;
        },
      ) {
        const chunks = chunker(input.non_fungible_ids, pageSize);
        return yield* Effect.forEach(
          chunks,
          Effect.fnUntraced(function* (chunk) {
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
) {}
