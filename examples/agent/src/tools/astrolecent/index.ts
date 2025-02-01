import { z } from 'zod'
import type { ToolFn } from '../../types'
import { astrolecentApiClient } from './astrolecentApiClient'

export const getTokenPricesToolDefinition = {
  name: 'token_prices',
  parameters: z.object({
    symbol: z.array(z.string()),
  }),
  description:
    'Get the prices of one or more tokens by symbol. Always prioritize the token with the highest TVL. Show the token symbol, name, description, TVL, divisibility, resource address, token price in USD, and token price in XRD.',
}

type Args = z.infer<typeof getTokenPricesToolDefinition.parameters>

export const getTokenPrices: ToolFn<Args, string> = async ({ toolArgs }) => {
  try {
    return await astrolecentApiClient
      .prices()
      .then((data) =>
        Object.entries(data)
          .filter(([_, token]) => token && token.tvl > 0)
          .filter(([_, token]) =>
            toolArgs.symbol.some(
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
      .then((data) => JSON.stringify(data))
  } catch (error) {
    return 'Error fetching token prices'
  }
}

export const swapTokensToolDefinition = {
  name: 'swap_tokens',
  parameters: z.object({
    inputToken: z.string().describe('The resource address of the Radix token'),
    outputToken: z.string().describe('The resource address of the Radix token'),
    inputAmount: z
      .number()
      .describe(
        'The amount that will be swapped from inputToken to outputToken',
      ),
    fromAddress: z.string().describe('The account address to perform the swap'),
  }),
  description: `This tool is used to get the swap quote from Astrolecent. 
    Always ask if the user accepts swap conditions.
    If accepted, output the transaction manifest.`,
}

type SwapArgs = z.infer<typeof swapTokensToolDefinition.parameters>

export const swapTokens: ToolFn<SwapArgs, string> = async ({ toolArgs }) => {
  try {
    const { inputToken, outputToken, inputAmount, fromAddress } = toolArgs
    return await astrolecentApiClient
      .swap({
        inputToken,
        outputToken,
        inputAmount,
        fromAddress,
      })
      .then((data) => JSON.stringify(data))
  } catch (error) {
    return 'Error executing swap'
  }
}
