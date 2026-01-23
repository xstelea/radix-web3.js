import type {
  ProgrammaticScryptoSborValue,
  StateEntityDetailsVaultResponseItem,
} from '@radixdlt/babylon-gateway-api-sdk';
import { Effect } from 'effect';
import type { ParsedType, StructDefinition, StructSchema } from 'sbor-ez-mode';
import type { AtLedgerState } from './schemas';
import {
  type GetEntityDetailsOptions,
  GetEntityDetailsVaultAggregated,
} from './state/getEntityDetailsVaultAggregated';

export class InvalidComponentStateError {
  readonly _tag = 'InvalidComponentStateError';
  constructor(readonly error: unknown) {}
}

export class GetComponentStateService extends Effect.Service<GetComponentStateService>()(
  'GetComponentStateService',
  {
    dependencies: [GetEntityDetailsVaultAggregated.Default],
    effect: Effect.gen(function* () {
      const getEntityDetails = yield* GetEntityDetailsVaultAggregated;

      return {
        run: Effect.fnUntraced(function* <
          T extends StructDefinition,
          R extends boolean,
        >(input: {
          addresses: string[];
          at_ledger_state: AtLedgerState;
          schema: StructSchema<T, R>;
          options?: GetEntityDetailsOptions;
        }) {
          const entityDetails = yield* getEntityDetails(
            input.addresses,
            input.options,
            input.at_ledger_state,
          );

          const results: {
            address: string;
            state: {
              [K in keyof T]: R extends true
                ? ParsedType<T[K]> | null
                : ParsedType<T[K]>;
            };
            details: StateEntityDetailsVaultResponseItem;
          }[] = [];

          for (const item of entityDetails) {
            if (item.details?.type === 'Component') {
              const componentDetails = item.details;
              const componentState =
                componentDetails.state as ProgrammaticScryptoSborValue;

              const parsed = input.schema.safeParse(componentState);

              if (parsed.isErr()) {
                return yield* Effect.fail(
                  new InvalidComponentStateError(parsed.error),
                );
              }

              if (parsed.isOk()) {
                results.push({
                  address: item.address,
                  state: parsed.value,
                  details: item,
                });
              }
            }
          }

          return results;
        }),
      };
    }),
  },
) {}
