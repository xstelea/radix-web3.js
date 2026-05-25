import { readFile } from 'node:fs/promises';
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

export const createX402Server = ({
  requirements,
  markdownPath,
  settlePayment,
}: X402ServerOptions): Hono => {
  const app = new Hono();

  app.get(
    '/protected/reference.md',
    createX402PaymentMiddleware({ requirements, settlePayment }),
    async (context) => {
      const markdown = await readFile(markdownPath, 'utf8');

      return context.body(markdown, 200, {
        'content-type': 'text/markdown; charset=utf-8',
      });
    },
  );

  return app;
};
