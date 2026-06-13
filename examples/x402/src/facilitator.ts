import { Effect } from 'effect';

import type { PaymentRequirements } from './paymentRequirements';

export type ValidatedPaymentSettlementInput = {
  signedPartialTransactionHex: string;
  requirements: PaymentRequirements;
  resourceUrl: string;
  payerAccount: string;
  subintentHash: string;
};

export type FacilitatorSettlementResult = {
  status: 'CommittedSuccess';
  payerAccount: string;
  subintentHash: string;
};

export type FacilitatorSettlementBackendOptions = {
  feePayerAccount: string;
  preview: (input: {
    rootManifest: string;
    signedPartialTransactionHex: string;
  }) => Effect.Effect<void, unknown>;
  submit: (input: {
    rootManifest: string;
    signedPartialTransactionHex: string;
  }) => Effect.Effect<{ transactionId: string }, unknown>;
  waitForCommittedSuccess: (input: {
    transactionId: string;
  }) => Effect.Effect<void, unknown>;
};

export const sponsoredRootManifest = (input: {
  feePayerAccount: string;
  requirements: PaymentRequirements;
  subintentHash: string;
}) => `USE_CHILD
    NamedIntent("payment")
    Intent("${input.subintentHash}")
;
CALL_METHOD
    Address("${input.feePayerAccount}")
    "lock_fee"
    Decimal("10")
;
YIELD_TO_CHILD NamedIntent("payment");
TAKE_ALL_FROM_WORKTOP
    Address("${input.requirements.asset}")
    Bucket("payment")
;
CALL_METHOD
    Address("${input.requirements.payTo}")
    "try_deposit_or_abort"
    Bucket("payment")
    None
;`;

export const createFacilitatorSettlementBackend = ({
  feePayerAccount,
  preview,
  submit,
  waitForCommittedSuccess,
}: FacilitatorSettlementBackendOptions) =>
  Effect.fn('facilitatorSettlementBackend')(function* (
    input: ValidatedPaymentSettlementInput,
  ) {
    const rootManifest = sponsoredRootManifest({
      feePayerAccount,
      requirements: input.requirements,
      subintentHash: input.subintentHash,
    });

    yield* preview({
      rootManifest,
      signedPartialTransactionHex: input.signedPartialTransactionHex,
    });
    const { transactionId } = yield* submit({
      rootManifest,
      signedPartialTransactionHex: input.signedPartialTransactionHex,
    });
    yield* waitForCommittedSuccess({ transactionId });

    return {
      status: 'CommittedSuccess',
      payerAccount: input.payerAccount,
      subintentHash: input.subintentHash,
    } satisfies FacilitatorSettlementResult;
  });
