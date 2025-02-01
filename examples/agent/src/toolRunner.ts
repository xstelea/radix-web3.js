import type OpenAI from 'openai'
import { getTokenPrices, swapTokens } from './tools/astrolecent'

export const runTool = async (
  toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
  userMessage: string,
) => {
  const input = {
    userMessage,
    toolArgs: JSON.parse(toolCall.function.arguments),
  }
  switch (toolCall.function.name) {
    case 'token_prices':
      return getTokenPrices(input)

    case 'swap_tokens':
      return swapTokens(input)

    default:
      throw new Error(`Unknown tool: ${toolCall.function.name}`)
  }
}
