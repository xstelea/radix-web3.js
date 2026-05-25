import { inspectSignedPartialTransaction as inspectWithTxTool } from '@radix-effects/tx-tool';
import { Data, Effect } from 'effect';
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

export class SignedPartialTransactionInspectionError extends Data.TaggedError(
  'SignedPartialTransactionInspectionError',
)<{
  reason: unknown;
}> {}

export type SponsoredSettlementOptions = {
  inspectSignedPartialTransaction?: (input: {
    signedPartialTransactionHex: string;
    networkId: 1;
  }) => Effect.Effect<PaymentSubintentInspection, unknown>;
  settleValidatedPayment: (input: {
    signedPartialTransactionHex: string;
    requirements: PaymentRequirements;
    resourceUrl: string;
    payerAccount: string;
    subintentHash: string;
  }) => Effect.Effect<
    CommittedSettlement | { status: string; subintentHash?: string },
    unknown
  >;
};

const inspectSignedPartialTransactionWithTxTool = (input: {
  signedPartialTransactionHex: string;
  networkId: 1;
}) =>
  Effect.tryPromise({
    try: () => inspectWithTxTool(input),
    catch: (reason) => new SignedPartialTransactionInspectionError({ reason }),
  });

export const createSponsoredSettlement = ({
  inspectSignedPartialTransaction = inspectSignedPartialTransactionWithTxTool,
  settleValidatedPayment,
}: SponsoredSettlementOptions) =>
  Effect.fn('sponsoredSettlement')(function* (input: SettlementInput) {
    const inspection = yield* inspectSignedPartialTransaction({
      signedPartialTransactionHex: input.signedPartialTransactionHex,
      networkId: 1,
    });
    const validation = yield* validateExactPaymentSubintent({
      inspection,
      requirements: input.requirements,
    });

    return yield* settleValidatedPayment({
      signedPartialTransactionHex: input.signedPartialTransactionHex,
      requirements: input.requirements,
      resourceUrl: input.resourceUrl,
      payerAccount: validation.payerAccount,
      subintentHash: validation.subintentHash,
    });
  });
