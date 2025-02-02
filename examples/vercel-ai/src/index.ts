import readline from 'node:readline'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import {
  AstrolecentPlugin,
  RadixCorePlugin,
  RadixWalletClient,
} from 'radix-agent-toolkit'

import { getOnChainTools } from '@goat-sdk/adapter-vercel-ai'
import { createRadixWeb3Client } from 'radix-web3.js'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const runAgent = async () => {
  const tools = await getOnChainTools({
    wallet: new RadixWalletClient({
      accountAddress: '',
      client: createRadixWeb3Client(),
    }),
    plugins: [new AstrolecentPlugin(), new RadixCorePlugin()],
  })

  const askQuestion = () => {
    rl.question('You: ', async (prompt) => {
      if (prompt.toLowerCase() === 'exit') {
        rl.close()
        return
      }

      const result = await generateText({
        model: openai('gpt-4o-mini'),
        tools,
        maxSteps: 10, // Maximum number of tool invocations per request
        prompt,
        onStepFinish: async (event) => {
          console.log('Tool execution:')
          console.log(JSON.stringify(event.toolResults, null, 2))
          console.log('Reasoning:', event.reasoning)
        },
        temperature: 0.1,
      })

      console.log('Assistant:', result.text)

      askQuestion()
    })
  }

  askQuestion()
}

runAgent()
// You are a based crypto degen assistant. You're knowledgeable about DeFi, NFTs, and trading. You use crypto slang naturally and stay up to date with Radix DLT ecosystem. You help users with their trades and provide market insights. Keep responses concise and use emojis occasionally.

// Previous conversation:
// ${conversationHistory.map((m) => `${m.role}: ${m.content}`).join("\n")}

// Current request: ${prompt}
