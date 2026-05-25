import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { Effect } from 'effect';
import {
  ConfigParseError,
  parseX402Config,
  paymentRequirementsFromConfig,
} from './config';
import { createX402Server } from './server';
import { createSponsoredSettlement } from './settlement';

const configPath = process.env.X402_CONFIG ?? 'x402.config.template.json';
const port = Number(process.env.PORT ?? 4020);

const program = Effect.gen(function* () {
  const rawConfig = yield* Effect.tryPromise({
    try: () => readFile(configPath, 'utf8'),
    catch: (reason) => new ConfigParseError({ reason }),
  });
  const config = yield* parseX402Config(rawConfig);
  const resourceUrl = `${config.resourceBaseUrl}/protected/reference.md`;
  const requirements = paymentRequirementsFromConfig({ config, resourceUrl });
  const markdownPath = fileURLToPath(
    new URL('../protected/reference.md', import.meta.url),
  );
  const settlePayment = createSponsoredSettlement({
    settleValidatedPayment: ({ payerAccount, subintentHash }) =>
      Effect.succeed(
        process.env.X402_MOCK_SETTLEMENT === 'true'
          ? {
              status: 'CommittedSuccess',
              payerAccount,
              subintentHash,
            }
          : {
              status: 'SettlementBackendNotConfigured',
              subintentHash,
            },
      ),
  });
  const app = createX402Server({
    requirements,
    markdownPath,
    settlePayment,
  });

  yield* Effect.sync(() => {
    serve({ fetch: app.fetch, port });
  });
  yield* Effect.logInfo(
    `x402 reference server listening on http://localhost:${port}`,
  );
});

Effect.runPromise(program);
