import { describe, expect, it } from 'vitest';
import type { PaymentRequirements } from './paymentRequirements';
import { settlementCacheKey } from './settlementCache';

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

describe('Settlement Cache Key', () => {
  it('is scoped to the subintent hash, payment requirements, and resource URL', () => {
    const key = settlementCacheKey({
      subintentHash: 'subtxid_A',
      requirements,
      resourceUrl: requirements.resourceUrl,
    });

    expect(
      settlementCacheKey({
        subintentHash: 'subtxid_B',
        requirements,
        resourceUrl: requirements.resourceUrl,
      }),
    ).not.toBe(key);

    expect(
      settlementCacheKey({
        subintentHash: 'subtxid_A',
        requirements: { ...requirements, amount: '2' },
        resourceUrl: requirements.resourceUrl,
      }),
    ).not.toBe(key);

    expect(
      settlementCacheKey({
        subintentHash: 'subtxid_A',
        requirements,
        resourceUrl: 'https://merchant.example/protected/other.md',
      }),
    ).not.toBe(key);
  });
});
