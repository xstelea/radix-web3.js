import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import type { PaymentRequirements } from './paymentRequirements';
import { createX402Server } from './server';

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

describe('x402 server', () => {
  it('serves the Protected Markdown File after CommittedSuccess', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'x402-example-'));
    const markdownPath = join(directory, 'reference.md');
    await writeFile(markdownPath, '# Paid Reference\n\nSettled content.\n');

    const app = createX402Server({
      requirements,
      markdownPath,
      settlePayment: () =>
        Effect.succeed({
          status: 'CommittedSuccess',
          subintentHash: 'subtxid_rdx1paid',
        }),
    });

    const response = await app.request('/protected/reference.md', {
      headers: {
        'X-PAYMENT': JSON.stringify({
          x402Version: 2,
          payload: { transaction: 'signed-partial-transaction-hex' },
        }),
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/markdown');
    expect(await response.text()).toBe(
      '# Paid Reference\n\nSettled content.\n',
    );
  });
});
