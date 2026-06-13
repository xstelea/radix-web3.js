import { afterEach, assert, describe, it, vi } from 'vitest';
import { z } from 'zod';

import { getTokenPricesMethod } from './tools/getTokenPricesTool';
import { swapTokensMethod } from './tools/swapTool';

const TokenPricesResult = z.array(
  z
    .object({
      symbol: z.string(),
      resourceAddress: z.string(),
    })
    .passthrough(),
);

const SwapResult = z
  .object({
    manifest: z.string(),
  })
  .passthrough();

const token = (input: {
  symbol: string;
  name: string;
  tvl: number;
  tokenPriceUSD: number;
}) => ({
  resourceAddress: `resource_${input.symbol.toLowerCase()}`,
  symbol: input.symbol,
  name: input.name,
  description: `${input.name} token`,
  iconUrl: '',
  infoUrl: '',
  divisibility: 18,
  tokenPriceXRD: input.tokenPriceUSD * 10,
  tokenPriceUSD: input.tokenPriceUSD,
  diff24H: 0,
  diff24HUSD: 0,
  diff7Days: 0,
  diff7DaysUSD: 0,
  volume24H: 0,
  volume7D: 0,
  totalSupply: 0,
  circSupply: 0,
  tvl: input.tvl,
  type: null,
  tags: [],
  createdAt: null,
  updatedAt: '2026-06-13T00:00:00.000Z',
  icon_url: '',
});

describe('Astrolecent tools', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns matching token prices ordered by TVL', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          Response.json({
            resource_low_xrd: token({
              symbol: 'XRD',
              name: 'Radix',
              tvl: 100,
              tokenPriceUSD: 1,
            }),
            resource_high_xrd: token({
              symbol: 'sXRD',
              name: 'Wrapped Radix',
              tvl: 500,
              tokenPriceUSD: 1.1,
            }),
            resource_zero: token({
              symbol: 'XRDZERO',
              name: 'Zero TVL',
              tvl: 0,
              tokenPriceUSD: 0,
            }),
            resource_other: token({
              symbol: 'BTC',
              name: 'Bitcoin',
              tvl: 1_000,
              tokenPriceUSD: 100_000,
            }),
          }),
        ),
      ),
    );

    const result = TokenPricesResult.parse(
      JSON.parse(await getTokenPricesMethod({ symbols: ['xrd'] })),
    );

    assert.deepEqual(
      result.map((item) => item.symbol),
      ['sXRD', 'XRD'],
    );
    assert.deepEqual(
      result.map((item) => item.resourceAddress),
      ['resource_high_xrd', 'resource_low_xrd'],
    );
  });

  it('serializes swap responses from the Astrolecent API', async () => {
    let requestedUrl = '';
    const fetchSpy = vi.fn((url: string | URL | Request) => {
      requestedUrl = url.toString();
      return Promise.resolve(
        Response.json({
          inputTokens: 1,
          outputTokens: 2,
          priceImpact: 0.01,
          swapFee: '0.1',
          manifest: 'CALL_METHOD;',
          routes: [],
        }),
      );
    });
    vi.stubGlobal('fetch', fetchSpy);

    const result = SwapResult.parse(
      JSON.parse(
        await swapTokensMethod({
          inputToken: 'resource_xrd',
          outputToken: 'resource_usdc',
          inputAmount: 1,
          fromAddress: 'account_rdx1payer',
        }),
      ),
    );

    assert.strictEqual(result.manifest, 'CALL_METHOD;');
    assert.strictEqual(
      requestedUrl,
      'https://api.astrolescent.com/partner/radix-web3/swap',
    );
  });

  it('does not call the swap API when input and output tokens match', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await swapTokensMethod({
      inputToken: 'resource_xrd',
      outputToken: 'resource_xrd',
      inputAmount: 1,
      fromAddress: 'account_rdx1payer',
    });

    assert.strictEqual(result, 'Error executing swap');
    assert.strictEqual(fetchSpy.mock.calls.length, 0);
  });
});
