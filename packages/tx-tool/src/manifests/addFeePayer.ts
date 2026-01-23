import type { Amount } from 'shared/brandedTypes';
import { TransactionManifestString } from 'shared/brandedTypes';
import type { Account } from 'shared/schemas/account';

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
