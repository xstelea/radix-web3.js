import 'dotenv/config'
import readline from 'node:readline'
import { runAgent } from './agent'
import { tools } from './tools'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const chat = () => {
  const askQuestion = () => {
    rl.question('You: ', async (prompt) => {
      if (prompt.toLowerCase() === 'exit') {
        rl.close()
        return
      }

      await runAgent({
        userMessage: prompt,
        tools,
      })

      askQuestion()
    })
  }

  askQuestion()
}

chat()
