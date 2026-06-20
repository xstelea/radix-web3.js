import { Data, Effect } from 'effect';

import { paymentSubintentManifest } from './exactRadix';
import type { PaymentRequirements } from './paymentRequirements';

export type PaymentSubintentInspection = {
  rootSubintentHash: {
    id: string | null;
    hex: string;
  };
  nonRootSubintentCount: number;
  rootSubintentSignatures: ReadonlyArray<{
    curve: 'Ed25519';
    signature: string;
    publicKey: string;
  }>;
  rootSubintent: {
    intentCore: {
      header: {
        networkId: number;
        intentDiscriminator: number;
      };
      instructions: string;
    };
  };
};

export class ExactPaymentSubintentValidationError extends Data.TaggedError(
  'ExactPaymentSubintentValidationError',
)<{
  code:
    | 'UNSUPPORTED_NETWORK'
    | 'MISSING_SIGNATURE'
    | 'NESTED_SUBINTENTS_UNSUPPORTED'
    | 'PAYER_ACCOUNT_NOT_FOUND'
    | 'NON_EXACT_PAYMENT_SUBINTENT';
}> {}

const normalizeManifest = (manifest: string) =>
  manifest.trim().replace(/\s+/g, ' ');

const payerAccountPattern = /CALL_METHOD\s+Address\("([^"]+)"\)\s+"withdraw"/;

export const validateExactPaymentSubintent = Effect.fn(
  'validateExactPaymentSubintent',
)(function* (input: {
  inspection: PaymentSubintentInspection;
  requirements: PaymentRequirements;
}) {
  if (input.inspection.rootSubintent.intentCore.header.networkId !== 1) {
    return yield* Effect.fail(
      new ExactPaymentSubintentValidationError({
        code: 'UNSUPPORTED_NETWORK',
      }),
    );
  }

  if (
    input.inspection.rootSubintent.intentCore.header.intentDiscriminator !==
    Number(input.requirements.extra.intentDiscriminator)
  ) {
    return yield* Effect.fail(
      new ExactPaymentSubintentValidationError({
        code: 'NON_EXACT_PAYMENT_SUBINTENT',
      }),
    );
  }

  if (input.inspection.rootSubintentSignatures.length === 0) {
    return yield* Effect.fail(
      new ExactPaymentSubintentValidationError({
        code: 'MISSING_SIGNATURE',
      }),
    );
  }

  if (input.inspection.nonRootSubintentCount !== 0) {
    return yield* Effect.fail(
      new ExactPaymentSubintentValidationError({
        code: 'NESTED_SUBINTENTS_UNSUPPORTED',
      }),
    );
  }

  const payerAccount = payerAccountPattern.exec(
    input.inspection.rootSubintent.intentCore.instructions,
  )?.[1];

  if (payerAccount === undefined) {
    return yield* Effect.fail(
      new ExactPaymentSubintentValidationError({
        code: 'PAYER_ACCOUNT_NOT_FOUND',
      }),
    );
  }

  const expectedManifest = paymentSubintentManifest({
    requirements: input.requirements,
    payerAccount,
  });

  if (
    normalizeManifest(expectedManifest) !==
    normalizeManifest(input.inspection.rootSubintent.intentCore.instructions)
  ) {
    return yield* Effect.fail(
      new ExactPaymentSubintentValidationError({
        code: 'NON_EXACT_PAYMENT_SUBINTENT',
      }),
    );
  }

  return {
    payerAccount,
    subintentHash:
      input.inspection.rootSubintentHash.id ??
      input.inspection.rootSubintentHash.hex,
  };
});
