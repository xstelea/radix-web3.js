import type { AIMessage } from './types'
import { runLLM } from './llm'
import { z } from 'zod'
import { runTool } from './toolRunner'
import { addMessages, getMessages, saveToolResponse } from './memory'
import { logMessage, showLoader } from './ui'

export const runAgent = async ({
  turns = 10,
  userMessage,
  tools = [],
}: {
  turns?: number
  userMessage: string
  tools?: { name: string; parameters: z.AnyZodObject }[]
}) => {
  await addMessages([
    {
      role: 'user',
      content: userMessage,
    },
  ])

  // const loader = showLoader('Thinking...')
  console.log('Thinking...')

  while (true) {
    const history = await getMessages()
    const response = await runLLM({
      messages: history,
      tools,
    })

    await addMessages([response])

    logMessage(response)

    if (response.content) {
      // loader.stop()
      console.log('Done')

      return getMessages()
    }

    if (response.tool_calls) {
      const toolCall = response.tool_calls[0]
      // loader.update(`executing: ${toolCall.function.name}`)
      console.log(`executing: ${toolCall.function.name}`)

      const toolResponse = await runTool(toolCall, userMessage)
      await saveToolResponse(toolCall.id, toolResponse)

      // loader.update(`executed: ${toolCall.function.name}`)
      console.log(`executed: ${toolCall.function.name}`)
    }
  }
}
