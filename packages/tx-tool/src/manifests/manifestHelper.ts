import { Effect } from 'effect';
import type { Amount } from 'shared/brandedTypes';
import { TransactionManifestString } from 'shared/brandedTypes';
import type { Account } from 'shared/schemas/account';

export class ManifestHelper extends Effect.Service<ManifestHelper>()(
  'ManifestHelper',
  {
    effect: Effect.gen(function* () {
      return {
        addFeePayer: (input: { account: Account; amount: Amount }) =>
          Effect.gen(function* () {
            if (input.account.type === 'unsecurifiedAccount') {
              return TransactionManifestString.make(`
                CALL_METHOD
                  Address("${input.account.address}")
                  "lock_fee"
                  Decimal("${input.amount}")
                ;
              `);
            }

            return TransactionManifestString.make(`
              CALL_METHOD
                Address("${input.account.accessControllerAddress}")
                "create_proof"
              ;

              CALL_METHOD
                Address("${input.account.address}")
                "lock_fee"
                Decimal("${input.amount}")
              ;
            `);
          }),
      };
    }),
  },
) {}
