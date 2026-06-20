import type { StateEntityDetailsVaultResponseItem } from '@radixdlt/babylon-gateway-api-sdk';
import { Context, Effect, Layer, Schema } from 'effect';

import type { AtLedgerState } from './schemas';
import {
  type GetEntityDetailsOptions,
  GetEntityDetailsVaultAggregated,
} from './state/getEntityDetailsVaultAggregated';

export class InvalidComponentStateError {
  readonly _tag = 'InvalidComponentStateError';
  constructor(readonly error: unknown) {}
}

export class GetComponentStateService extends Context.Service<GetComponentStateService>()(
  'GetComponentStateService',
  {
    make: Effect.gen(function* () {
      const getEntityDetails = yield* GetEntityDetailsVaultAggregated;

      return {
        run: Effect.fn('GetComponentStateService.run')(function* <
          S extends Schema.Top,
        >(input: {
          addresses: string[];
          at_ledger_state?: AtLedgerState;
          schema: S;
          options?: GetEntityDetailsOptions;
        }) {
          const entityDetails = yield* getEntityDetails(
            input.addresses,
            input.options,
            input.at_ledger_state,
          );

          const results: {
            address: string;
            state: S['Type'];
            details: StateEntityDetailsVaultResponseItem;
          }[] = [];

          for (const item of entityDetails) {
            if (item.details?.type === 'Component') {
              const componentDetails = item.details;

              const parsed = yield* Schema.decodeUnknownEffect(input.schema)(
                componentDetails.state,
              ).pipe(
                Effect.mapError(
                  (error) => new InvalidComponentStateError(error),
                ),
              );

              results.push({
                address: item.address,
                state: parsed,
                details: item,
              });
            }
          }

          return results;
        }),
      };
    }),
  },
) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(GetEntityDetailsVaultAggregated.Default),
  );
}
