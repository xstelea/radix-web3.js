import type { StateKeyValueStoreKeysRequest } from '@radixdlt/babylon-gateway-api-sdk';
import { Config, Effect } from 'effect';
import { GatewayApiClient } from './gatewayApiClient';
import type { AtLedgerState } from './schemas';

export class KeyValueStoreKeysService extends Effect.Service<KeyValueStoreKeysService>()(
  'KeyValueStoreKeysService',
  {
    effect: Effect.gen(function* () {
      const gatewayClient = yield* GatewayApiClient;

      const pageSize = yield* Config.number(
        'GatewayApi__Endpoint__MaxPageSize',
      ).pipe(Config.withDefault(100));

      return Effect.fn(function* (
        input: Omit<StateKeyValueStoreKeysRequest, 'at_ledger_state'> & {
          at_ledger_state?: AtLedgerState;
        },
      ) {
        return yield* gatewayClient.state.innerClient.keyValueStoreKeys({
          stateKeyValueStoreKeysRequest: {
            ...input,
            limit_per_page: pageSize,
          },
        });
      });
    }),
  },
) {}
