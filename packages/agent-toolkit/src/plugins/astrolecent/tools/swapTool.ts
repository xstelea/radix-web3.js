import { createTool } from '@goat-sdk/core';
import { z } from 'zod';
import { astrolecentApiClient } from '../astrolecentApiClient';

export const swapTokensToolDefinition = {
  name: 'swap_tokens',
  parameters: z.object({
    inputToken: z
      .string()
      .describe('resource address of the token to swap from'),
    outputToken: z
      .string()
      .describe('resource address of the token to swap to'),
    inputAmount: z
      .number()
      .describe(
        'The amount that will be swapped from inputToken to outputToken',
      ),
    fromAddress: z.string().describe('The account address to perform the swap'),
  }),
  description:
    'This tool is used to swap input token to output token using Astrolecent DEX.',
};

export const swapTokensMethod = async (
  parameters: z.infer<typeof swapTokensToolDefinition.parameters>,
) => {
  try {
    const { inputToken, outputToken, inputAmount, fromAddress } = parameters;
    if (inputToken === outputToken) {
      throw new Error('inputToken and outputToken cannot be the same');
    }
    return await astrolecentApiClient
      .swap({
        inputToken,
        outputToken,
        inputAmount,
        fromAddress,
      })
      .then((data) => JSON.stringify(data));
  } catch (error) {
    return 'Error executing swap';
  }
};

export const swapTokensTool = createTool(
  {
    name: 'swap_tokens',
    description:
      'This tool is used to swap tokens Radix tokens through Astrolecent.',
    parameters: swapTokensToolDefinition.parameters,
  },
  (parameters: z.infer<typeof swapTokensToolDefinition.parameters>) =>
    swapTokensMethod(parameters),
);
