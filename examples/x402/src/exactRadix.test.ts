import { describe, expect, it } from 'vitest';
import {
  paymentSubintentManifest,
  previewRootManifest,
  subintentHashPlaceholder,
} from './exactRadix';
import type { PaymentRequirements } from './paymentRequirements';

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
    notaryBadge:
      'resource_rdx1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxx3e2cpa:[11111111111111111111111111111111]',
    intentDiscriminator: '123',
  },
};

describe('exact Radix payment manifests', () => {
  it('builds the exact sponsored payment Subintent instruction sequence', () => {
    expect(
      paymentSubintentManifest({
        requirements,
        payerAccount:
          'account_rdx129a9wuey40lducsne6r8e5q7xmt07068gcede0x0nrwtsnehpkf6zh',
      }),
    ).toBe(`VERIFY_PARENT
    Enum<AccessRule::Protected>(
        Enum<CompositeRequirement::BasicRequirement>(
            Enum<BasicRequirement::Require>(
                Enum<ResourceOrNonFungible::NonFungible>(
                    NonFungibleGlobalId("resource_rdx1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxx3e2cpa:[11111111111111111111111111111111]")
                )
            )
        )
    )
;
ASSERT_WORKTOP_IS_EMPTY;
CALL_METHOD
    Address("account_rdx129a9wuey40lducsne6r8e5q7xmt07068gcede0x0nrwtsnehpkf6zh")
    "withdraw"
    Address("resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd")
    Decimal("1.5")
;
TAKE_ALL_FROM_WORKTOP
    Address("resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd")
    Bucket("payment")
;
YIELD_TO_PARENT Bucket("payment");`);
  });

  it('builds preview root manifest with one Subintent hash placeholder', () => {
    const manifest = previewRootManifest({
      requirements,
      feePayerAccount:
        'account_rdx12fee2he2pm0qdgrwn9nsymr8v3n2dr59u2rwzfq8t2vrlv9av0000',
    });

    expect(manifest.split(subintentHashPlaceholder)).toHaveLength(2);
    expect(manifest).toContain('YIELD_TO_CHILD NamedIntent("payment");');
    expect(manifest).toContain('"try_deposit_or_abort"');
  });
});
