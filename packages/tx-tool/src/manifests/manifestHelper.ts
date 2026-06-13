import type { Amount } from '@radix-effects/shared';
import { TransactionManifestString } from '@radix-effects/shared';
import type { Account } from '@radix-effects/shared';
import { Context, Effect, Layer } from 'effect';

export class ManifestHelper extends Context.Service<ManifestHelper>()(
  'ManifestHelper',
  {
    make: Effect.gen(function* () {
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
) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies;
}
