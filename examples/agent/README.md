# CLI Chat Agent

A CLI-based AI agent demonstrating:

- Interactive chat interface with OpenAI GPT models
- Tool integration with Astrolescent DeFi protocol
- Persistent conversation history using LowDB

## Features

- Token price lookups and swaps via Astrolescent API
- Streaming responses with loading indicators
- Function calling with structured outputs
- Conversation memory stored in JSON file

## Usage

Create a `.env` file in the agent root:

```bash
OPENAI_API_KEY=sk-...
```

Install dependencies:

```bash
pnpm install
```

Run the agent:

```bash
pnpm start
```

## Project Structure

- `src/agent.ts` - Core agent logic and message handling
- `src/tools/astrolecent/` - Astrolescent API integration
- `src/memory.ts` - Conversation history persistence
- `src/ui.ts` - CLI interface and loading indicators

## Tools

Currently supports:

- `token_prices` - Get token prices and metadata
- `swap_tokens` - Execute token swaps via Astrolescent

## Credits

Code inspired by [Build an AI Agent from Scratch Workshop](https://github.com/Hendrixer/agent-from-scratch)
