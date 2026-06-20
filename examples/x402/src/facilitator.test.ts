import { assert, describe, it } from '@effect/vitest';
import { Effect } from 'effect';

import { createFacilitatorSettlementBackend } from './facilitator';
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
    notaryBadge: 'notary-badge',
    intentDiscriminator: '123',
  },
};

describe('facilitator settlement backend', () => {
  it.effect(
    'builds sponsored root manifest and waits for CommittedSuccess',
    () =>
      Effect.gen(function* () {
        const calls: string[] = [];
        const settle = createFacilitatorSettlementBackend({
          feePayerAccount:
            'account_rdx12fee2he2pm0qdgrwn9nsymr8v3n2dr59u2rwzfq8t2vrlv9av0000',
          preview: ({ rootManifest }) =>
            Effect.sync(() => {
              calls.push('preview');
              assert.include(rootManifest, 'lock_fee');
              assert.include(
                rootManifest,
                'YIELD_TO_CHILD NamedIntent("payment")',
              );
              assert.include(rootManifest, 'Intent("subtxid_rdx1paid")');
            }),
          submit: () =>
            Effect.sync(() => {
              calls.push('submit');
              return { transactionId: 'txid_rdx1settlement' };
            }),
          waitForCommittedSuccess: ({ transactionId }) =>
            Effect.sync(() => {
              calls.push(`wait:${transactionId}`);
            }),
        });

        const result = yield* settle({
          requirements,
          resourceUrl: requirements.resourceUrl,
          signedPartialTransactionHex: '4d220504',
          payerAccount:
            'account_rdx129a9wuey40lducsne6r8e5q7xmt07068gcede0x0nrwtsnehpkf6zh',
          subintentHash: 'subtxid_rdx1paid',
        });

        assert.deepStrictEqual(result, {
          status: 'CommittedSuccess',
          payerAccount:
            'account_rdx129a9wuey40lducsne6r8e5q7xmt07068gcede0x0nrwtsnehpkf6zh',
          subintentHash: 'subtxid_rdx1paid',
        });
        assert.deepStrictEqual(calls, [
          'preview',
          'submit',
          'wait:txid_rdx1settlement',
        ]);
      }),
  );
});
