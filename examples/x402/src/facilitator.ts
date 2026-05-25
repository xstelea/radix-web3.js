import type { PaymentRequirements } from './paymentRequirements';

export type ValidatedPaymentSettlementInput = {
  signedPartialTransactionHex: string;
  requirements: PaymentRequirements;
  resourceUrl: string;
  payerAccount: string;
  subintentHash: string;
};

export type FacilitatorSettlementBackendOptions = {
  feePayerAccount: string;
  preview: (input: {
    rootManifest: string;
    signedPartialTransactionHex: string;
  }) => Promise<void>;
  submit: (input: {
    rootManifest: string;
    signedPartialTransactionHex: string;
  }) => Promise<{ transactionId: string }>;
  waitForCommittedSuccess: (input: { transactionId: string }) => Promise<void>;
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

export const createFacilitatorSettlementBackend =
  ({
    feePayerAccount,
    preview,
    submit,
    waitForCommittedSuccess,
  }: FacilitatorSettlementBackendOptions) =>
  async (input: ValidatedPaymentSettlementInput) => {
    const rootManifest = sponsoredRootManifest({
      feePayerAccount,
      requirements: input.requirements,
      subintentHash: input.subintentHash,
    });

    await preview({
      rootManifest,
      signedPartialTransactionHex: input.signedPartialTransactionHex,
    });
    const { transactionId } = await submit({
      rootManifest,
      signedPartialTransactionHex: input.signedPartialTransactionHex,
    });
    await waitForCommittedSuccess({ transactionId });

    return {
      status: 'CommittedSuccess' as const,
      payerAccount: input.payerAccount,
      subintentHash: input.subintentHash,
    };
  };
