import { describe, expect, it } from '@effect/vitest';

import {
  type PaymentRequirements,
  paymentRequirementsHash,
} from './paymentRequirements';

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
  advisoryPaymentManifestTemplate: 'manifest version a',
  advisoryPreviewRootManifestTemplate: 'preview version a',
};

describe('Payment Requirements Hash', () => {
  it('is stable when only advisory templates change', () => {
    const changedAdvisoryTemplates: PaymentRequirements = {
      ...requirements,
      advisoryPaymentManifestTemplate: 'manifest version b',
      advisoryPreviewRootManifestTemplate: 'preview version b',
    };

    expect(paymentRequirementsHash(changedAdvisoryTemplates)).toBe(
      paymentRequirementsHash(requirements),
    );
  });
});
