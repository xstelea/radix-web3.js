import { inspectSignedPartialTransaction as inspectWithTxTool } from '@radix-effects/tx-tool';
import { Effect } from 'effect';
import type { PaymentRequirements } from './paymentRequirements';
import {
  type PaymentSubintentInspection,
  validateExactPaymentSubintent,
} from './paymentValidation';

export type SettlementInput = {
  signedPartialTransactionHex: string;
  requirements: PaymentRequirements;
  resourceUrl: string;
};

export type CommittedSettlement = {
  status: 'CommittedSuccess';
  payerAccount: string;
  subintentHash: string;
};

export type SponsoredSettlementOptions = {
  inspectSignedPartialTransaction?: (input: {
    signedPartialTransactionHex: string;
    networkId: 1;
  }) => Promise<PaymentSubintentInspection>;
  settleValidatedPayment: (input: {
    signedPartialTransactionHex: string;
    requirements: PaymentRequirements;
    resourceUrl: string;
    payerAccount: string;
    subintentHash: string;
  }) => Promise<
    CommittedSettlement | { status: string; subintentHash?: string }
  >;
};

export const createSponsoredSettlement =
  ({
    inspectSignedPartialTransaction = inspectWithTxTool,
    settleValidatedPayment,
  }: SponsoredSettlementOptions) =>
  async (input: SettlementInput) => {
    const inspection = await inspectSignedPartialTransaction({
      signedPartialTransactionHex: input.signedPartialTransactionHex,
      networkId: 1,
    });
    const validation = await Effect.runPromise(
      validateExactPaymentSubintent({
        inspection,
        requirements: input.requirements,
      }),
    );

    return settleValidatedPayment({
      signedPartialTransactionHex: input.signedPartialTransactionHex,
      requirements: input.requirements,
      resourceUrl: input.resourceUrl,
      payerAccount: validation.payerAccount,
      subintentHash: validation.subintentHash,
    });
  };
