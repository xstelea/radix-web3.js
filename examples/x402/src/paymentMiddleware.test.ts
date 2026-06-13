import { assert, describe, expect, it } from '@effect/vitest';
import { Effect } from 'effect';
import { Hono } from 'hono';

import { createX402PaymentMiddleware } from './paymentMiddleware';
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

describe('x402 Payment Middleware', () => {
  it('returns 402 Structured Payment Requirements when payment is missing', async () => {
    const app = new Hono();

    app.get(
      '/protected/reference.md',
      createX402PaymentMiddleware({ requirements }),
      (context) => context.text('paid resource'),
    );

    const response = await app.request('/protected/reference.md');

    expect(response.status).toBe(402);
    expect(await response.json()).toEqual({
      x402Version: 2,
      accepts: [
        {
          ...requirements,
          paymentRequirementsHash: expect.any(String),
        },
      ],
    });
  });

  it('does not serve the protected resource when settlement is not CommittedSuccess', async () => {
    const app = new Hono();

    app.get(
      '/protected/reference.md',
      createX402PaymentMiddleware({
        requirements,
        settlePayment: () => Effect.succeed({ status: 'Submitted' }),
      }),
      (context) => context.text('paid resource'),
    );

    const response = await app.request('/protected/reference.md', {
      headers: {
        'X-PAYMENT': JSON.stringify({
          x402Version: 2,
          payload: { transaction: 'signed-partial-transaction-hex' },
        }),
      },
    });

    expect(response.status).toBe(402);
    expect(await response.json()).toEqual({
      error: 'payment_not_settled',
      paymentStatus: 'Submitted',
    });
  });

  it('returns 402 when the payment payload cannot be decoded', async () => {
    const app = new Hono();

    app.get(
      '/protected/reference.md',
      createX402PaymentMiddleware({
        requirements,
      }),
      (context) => context.text('paid resource'),
    );

    const response = await app.request('/protected/reference.md', {
      headers: {
        'X-PAYMENT': '{',
      },
    });

    expect(response.status).toBe(402);
    expect(await response.json()).toEqual({
      error: 'invalid_payment_payload',
    });
  });

  it.effect(
    'keeps the Protected Route Surface locked when settlement throws before returning an Effect',
    () =>
      Effect.gen(function* () {
        const app = new Hono();

        app.get(
          '/protected/reference.md',
          createX402PaymentMiddleware({
            requirements,
            settlePayment: () => {
              throw new Error('settlement backend unavailable');
            },
          }),
          (context) => context.text('paid resource'),
        );

        const response = yield* Effect.tryPromise(() =>
          Promise.resolve(
            app.request('/protected/reference.md', {
              headers: {
                'X-PAYMENT': JSON.stringify({
                  x402Version: 2,
                  payload: { transaction: 'signed-partial-transaction-hex' },
                }),
              },
            }),
          ),
        );

        assert.strictEqual(response.status, 402);
        assert.deepEqual(yield* Effect.tryPromise(() => response.json()), {
          error: 'payment_not_settled',
          paymentStatus: 'SettlementFailed',
        });
      }),
  );

  it('reuses in-memory Settlement Records after CommittedSuccess', async () => {
    const app = new Hono();
    let settlementAttempts = 0;

    app.get(
      '/protected/reference.md',
      createX402PaymentMiddleware({
        requirements,
        settlePayment: () => {
          settlementAttempts += 1;
          return Effect.succeed({
            status: 'CommittedSuccess',
            subintentHash: 'subtxid_rdx1paid',
          });
        },
      }),
      (context) => context.text('paid resource'),
    );

    const request = {
      headers: {
        'X-PAYMENT': JSON.stringify({
          x402Version: 2,
          payload: { transaction: 'signed-partial-transaction-hex' },
        }),
      },
    };

    expect((await app.request('/protected/reference.md', request)).status).toBe(
      200,
    );
    expect((await app.request('/protected/reference.md', request)).status).toBe(
      200,
    );
    expect(settlementAttempts).toBe(1);
  });
});
