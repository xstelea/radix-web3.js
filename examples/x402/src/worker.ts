import { Effect } from 'effect';
import { Hono } from 'hono';

import {
  type X402Config,
  paymentRequirementsFromConfig,
  validateX402Config,
} from './config';
import { createX402PaymentMiddleware } from './paymentMiddleware';

type X402WorkerEnv = {
  GATEWAY_BASE_URL: string;
  RESOURCE_BASE_URL: string;
  FEE_PAYER_ACCOUNT: string;
  PAY_TO_ACCOUNT: string;
  FACILITATOR_NOTARY_BADGE: string;
  PAYMENT_ASSET: string;
  PAYMENT_AMOUNT: string;
  MAX_TIMEOUT_SECONDS: string;
  INTENT_DISCRIMINATOR: string;
  X402_MOCK_SETTLEMENT?: string;
};

const protectedMarkdown = `# x402 Radix Protected Reference

This markdown file is served only after the x402 Payment Middleware observes a settled Radix sponsored payment.
`;

const configFromEnv = (env: X402WorkerEnv): X402Config => ({
  networkId: 1,
  gatewayBaseUrl: env.GATEWAY_BASE_URL,
  resourceBaseUrl: env.RESOURCE_BASE_URL,
  feePayerAccount: env.FEE_PAYER_ACCOUNT,
  payTo: env.PAY_TO_ACCOUNT,
  facilitatorNotaryBadge: env.FACILITATOR_NOTARY_BADGE,
  asset: env.PAYMENT_ASSET,
  amount: env.PAYMENT_AMOUNT,
  maxTimeoutSeconds: Number(env.MAX_TIMEOUT_SECONDS),
  intentDiscriminator: env.INTENT_DISCRIMINATOR,
});

const createWorkerApp = Effect.fn('createX402WorkerApp')(function* (
  env: X402WorkerEnv,
  requestUrl: string,
) {
  const config = yield* validateX402Config(configFromEnv(env));
  const resourceUrl = new URL('/protected/reference.md', requestUrl).toString();
  const requirements = paymentRequirementsFromConfig({ config, resourceUrl });
  const app = new Hono();

  app.get('/', (context) => context.redirect('/protected/reference.md'));
  app.get(
    '/protected/reference.md',
    createX402PaymentMiddleware({
      requirements,
      settlePayment: ({ signedPartialTransactionHex }) =>
        env.X402_MOCK_SETTLEMENT === 'true'
          ? Effect.succeed({
              status: 'CommittedSuccess',
              subintentHash: `mock-${signedPartialTransactionHex}`,
            })
          : Effect.succeed({
              status: 'SettlementBackendNotConfigured',
            }),
    }),
    (context) =>
      context.body(protectedMarkdown, 200, {
        'content-type': 'text/markdown; charset=utf-8',
      }),
  );

  return app;
});

export default {
  fetch(request: Request, env: X402WorkerEnv): Promise<Response> {
    return Effect.runPromise(
      Effect.gen(function* () {
        const app = yield* createWorkerApp(env, request.url);
        return yield* Effect.tryPromise(() =>
          Promise.resolve(app.fetch(request)),
        );
      }).pipe(
        Effect.catch((error) =>
          Effect.succeed(
            Response.json(
              {
                error: 'x402_worker_startup_failed',
                reason:
                  typeof error === 'object' && error !== null && '_tag' in error
                    ? error._tag
                    : 'UnknownError',
              },
              { status: 500 },
            ),
          ),
        ),
      ),
    );
  },
};
