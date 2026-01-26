import type { Amount } from '@radix-effects/shared';
import { TransactionManifestString } from '@radix-effects/shared';
import type { Account } from '@radix-effects/shared';

export const addFeePayer = (input: { account: Account; amount: Amount }) => {
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
};
