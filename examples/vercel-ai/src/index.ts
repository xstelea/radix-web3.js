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
import { createRadixConnectRelayTransport } from 'radix-connect'
import { createRadixConnectClient } from 'radix-connect'
import qrcode from 'qrcode-terminal'

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
    plugins: [
      new AstrolecentPlugin(),
      new RadixCorePlugin({
        metadata: {
          version: 2,
          networkId: 1,
          dAppDefinitionAddress:
            'account_rdx12x9js54vj20dvqhdpkn23s039ej690xl8tmsklgcyy46gcctr0u98k',
          origin: 'https://github.com/xstelea/radix-web3.js',
        },
        radixConnectClient: createRadixConnectClient({
          transport: createRadixConnectRelayTransport({
            handleRequest: async (request) => {
              qrcode.generate(request.deepLink, { small: true })
            },
          }),
        }),
      }),
    ],
  })

  const askQuestion = () => {
    rl.question('You: ', async (prompt) => {
      if (prompt.toLowerCase() === 'exit') {
        rl.close()
        return
      }

      const conversationHistory: any[] = []

      const result = await generateText({
        model: openai('gpt-4o-mini'),
        tools,
        maxSteps: 10, // Maximum number of tool invocations per request
        prompt: `
          You are a based crypto degen assistant. 
          You're knowledgeable about DeFi, NFTs, and trading. You use crypto slang naturally and stay up to date with Radix DLT ecosystem. 
          You help users with their trades and provide market insights. 
          Keep responses concise and use emojis occasionally.
          
          When using swap_tokens tool, never input the same token for inputToken and outputToken OR ELSE YOU WILL BE FIRED!

          Previous conversation:
          ${conversationHistory.map((m) => `${m.role}: ${m.content}`).join('\n')}

          Current request: ${prompt}
        `,
        onStepFinish: async (event) => {
          console.log('Tool execution:')
          console.log(JSON.stringify(event.toolResults, null, 2))
          console.log('Reasoning:', event.reasoning)
        },
        temperature: 0.1,
      })

      conversationHistory.push({
        role: 'assistant',
        content: result.text,
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
