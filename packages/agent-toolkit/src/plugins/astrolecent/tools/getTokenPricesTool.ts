import { createTool } from '@goat-sdk/core';
import { z } from 'zod';
import { astrolecentApiClient } from '../astrolecentApiClient';

export const getTokenPricesParametersSchema = z.object({
  symbols: z.array(z.string()),
});

export const getTokenPricesMethod = async (
  parameters: z.infer<typeof getTokenPricesParametersSchema>,
) => {
  try {
    const { symbols } = parameters;
    return await astrolecentApiClient
      .prices()
      .then((data) =>
        Object.entries(data)
          .filter(([_, token]) => token && token.tvl > 0)
          .filter(([_, token]) =>
            symbols.some(
              (s) =>
                token.symbol.toLowerCase().includes(s.toLowerCase()) ||
                s.toLowerCase().includes(token.symbol.toLowerCase()),
            ),
          )
          .map(
            ([
              resourceAddress,
              {
                symbol,
                name,
                tvl,
                divisibility,
                description,
                tokenPriceUSD,
                tokenPriceXRD,
              },
            ]) => ({
              name,
              symbol,
              description,
              tvl,
              divisibility,
              resourceAddress,
              tokenPriceUSD,
              tokenPriceXRD,
            }),
          )
          .sort((a, b) => b.tvl - a.tvl),
      )
      .then((data) => JSON.stringify(data));
  } catch (error) {
    throw new Error(`Failed to swap: ${error}`);
  }
};

export const getTokenPricesTool = createTool(
  {
    name: 'get_token_prices',
    description:
      'Get the prices of one or more tokens by symbol. Always prioritize the token with the highest TVL. Show the token symbol, name, description, TVL, divisibility, resource address, token price in USD, and token price in XRD.',
    parameters: getTokenPricesParametersSchema,
  },
  (parameters: z.infer<typeof getTokenPricesParametersSchema>) =>
    getTokenPricesMethod(parameters),
);
