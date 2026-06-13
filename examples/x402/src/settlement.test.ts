import { assert, describe, it } from '@effect/vitest';
import { Effect } from 'effect';

import { paymentSubintentManifest } from './exactRadix';
import type { PaymentRequirements } from './paymentRequirements';
import { createSponsoredSettlement } from './settlement';

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

describe('Sponsored Subintent settlement', () => {
  it.effect('inspects, validates, settles, and returns CommittedSuccess', () =>
    Effect.gen(function* () {
      const settlePayment = createSponsoredSettlement({
        inspectSignedPartialTransaction: () =>
          Effect.succeed({
            rootSubintentHash: { id: 'subtxid_rdx1paid', hex: 'aa' },
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
          }),
        settleValidatedPayment: ({ payerAccount, subintentHash }) =>
          Effect.succeed({
            status: 'CommittedSuccess',
            payerAccount,
            subintentHash,
          }),
      });

      const result = yield* settlePayment({
        requirements,
        resourceUrl: requirements.resourceUrl,
        signedPartialTransactionHex: '4d220504',
      });

      assert.deepStrictEqual(result, {
        status: 'CommittedSuccess',
        payerAccount:
          'account_rdx129a9wuey40lducsne6r8e5q7xmt07068gcede0x0nrwtsnehpkf6zh',
        subintentHash: 'subtxid_rdx1paid',
      });
    }),
  );
});
