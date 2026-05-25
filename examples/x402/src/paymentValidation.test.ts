import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { paymentSubintentManifest } from './exactRadix';
import type { PaymentRequirements } from './paymentRequirements';
import {
  ExactPaymentSubintentValidationError,
  type PaymentSubintentInspection,
  validateExactPaymentSubintent,
} from './paymentValidation';

const requirements: PaymentRequirements = {
  scheme: 'exact',
  network: 'radix:mainnet',
  resourceUrl: 'https://merchant.example/protected/reference.md',
  payTo: 'account_rdx1282dj2he2pm0qdgrwn9nsymr8v3n2dr59u2rwzfq8t2vrlv9av74j4',
  asset: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
  amount: '1.5',
  maxTimeoutSeconds: 60,
  extra: {
    mode: 'sponsored',
    notaryBadge: 'notary-badge',
    intentDiscriminator: '123',
  },
};

const inspection: PaymentSubintentInspection = {
  rootSubintentHash: {
    id: 'subtxid_rdx1valid',
    hex: 'aa',
  },
  nonRootSubintentCount: 0,
  rootSubintentSignatures: [
    {
      curve: 'Ed25519',
      signature: '22'.repeat(64),
      publicKey: '11'.repeat(32),
    },
  ],
  rootSubintent: {
    intentCore: {
      header: {
        networkId: 1,
        intentDiscriminator: 123,
      },
      instructions: paymentSubintentManifest({
        requirements,
        payerAccount:
          'account_rdx129a9wuey40lducsne6r8e5q7xmt07068gcede0x0nrwtsnehpkf6zh',
      }),
    },
  },
};

describe('Exact Payment Subintent validation', () => {
  it('accepts the exact sponsored payment Subintent shape and derives payer details', async () => {
    const result = await Effect.runPromise(
      validateExactPaymentSubintent({
        inspection,
        requirements,
      }),
    );

    expect(result).toEqual({
      payerAccount:
        'account_rdx129a9wuey40lducsne6r8e5q7xmt07068gcede0x0nrwtsnehpkf6zh',
      subintentHash: 'subtxid_rdx1valid',
    });
  });

  it('rejects variants from the exact sponsored payment Subintent shape', async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        validateExactPaymentSubintent({
          requirements,
          inspection: {
            ...inspection,
            rootSubintent: {
              intentCore: {
                ...inspection.rootSubintent.intentCore,
                instructions:
                  inspection.rootSubintent.intentCore.instructions.replace(
                    'Decimal("1.5")',
                    'Decimal("2")',
                  ),
              },
            },
          },
        }),
      ),
    );

    expect(error).toBeInstanceOf(ExactPaymentSubintentValidationError);
    expect(error.code).toBe('NON_EXACT_PAYMENT_SUBINTENT');
  });
});
