import { readFile } from 'node:fs/promises';

import { Data, Effect } from 'effect';
import { Hono } from 'hono';

import {
  type X402PaymentMiddlewareOptions,
  createX402PaymentMiddleware,
} from './paymentMiddleware';
import type { PaymentRequirements } from './paymentRequirements';

export type X402ServerOptions = {
  requirements: PaymentRequirements;
  markdownPath: string;
  settlePayment: X402PaymentMiddlewareOptions['settlePayment'];
};

export class ProtectedMarkdownReadError extends Data.TaggedError(
  'ProtectedMarkdownReadError',
)<{
  path: string;
  reason: unknown;
}> {}

const readProtectedMarkdown = Effect.fn('readProtectedMarkdown')(
  (path: string) =>
    Effect.tryPromise({
      try: () => readFile(path, 'utf8'),
      catch: (reason) => new ProtectedMarkdownReadError({ path, reason }),
    }),
);

export const createX402Server = ({
  requirements,
  markdownPath,
  settlePayment,
}: X402ServerOptions): Hono => {
  const app = new Hono();

  app.get(
    '/protected/reference.md',
    createX402PaymentMiddleware({ requirements, settlePayment }),
    (context) =>
      Effect.runPromise(
        readProtectedMarkdown(markdownPath).pipe(
          Effect.map((markdown) =>
            context.body(markdown, 200, {
              'content-type': 'text/markdown; charset=utf-8',
            }),
          ),
        ),
      ),
  );

  return app;
};
