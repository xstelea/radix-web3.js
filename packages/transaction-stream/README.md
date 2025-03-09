# Radix Transaction Stream

A utility package for streaming transactions from the Radix ledger in a reliable and efficient manner.

## Installation

```bash
npm install radix-transaction-stream
```

## Features

- Stream transactions from the Radix ledger with automatic state version management
- Error handling for common issues like state version beyond known ledger
- Configurable transaction batch size
- Optional debug logging
- Type-safe API with proper error handling using `neverthrow`

## Usage

### Basic Usage

```typescript
import { createTransactionStream } from 'radix-transaction-stream'

// Create a transaction stream with default settings
const transactionStream = createTransactionStream()

// Process transactions in a loop
const processTransactions = async () => {
  while (true) {
    const result = await transactionStream.next()

    if (result.isErr()) {
      // Handle errors
      console.error('Error fetching transactions:', result.error)

      // Special handling for state version beyond known ledger
      if (
        'parsedError' in result.error &&
        result.error.parsedError === 'StateVersionBeyondEndOfKnownLedger'
      ) {
        console.log('Reached end of ledger, waiting for new transactions...')
        await new Promise((resolve) => setTimeout(resolve, 1000))
        continue
      }
    } else {
      // Process transactions
      const { stateVersion, transactions } = result.value
      console.log(
        `Processing ${transactions.length} transactions at state version ${stateVersion}`,
      )

      // Your transaction processing logic here
      for (const tx of transactions) {
        // Process each transaction
      }
    }
  }
}

processTransactions()
```

### Advanced Configuration

```typescript
import { createTransactionStream } from 'radix-transaction-stream'
import { createRadixNetworkClient } from 'radix-web3.js'

// Create a custom network client
const gatewayApi = createRadixNetworkClient({
  networkId: 1, // Mainnet
  // Other configuration options
})

// Create a transaction stream with custom settings
const transactionStream = createTransactionStream({
  gatewayApi, // Custom network client
  startStateVersion: 1000, // Start from a specific state version
  numberOfTransactions: 50, // Number of transactions to fetch per request
  debug: true, // Enable debug logging
  logLevel: 'debug', // Log level (debug, info, warn, error, trace)
})

// Use the transaction stream
const result = await transactionStream.next()
```

## API Reference

### `createTransactionStream(options?)`

Creates a new transaction stream instance.

#### Options

| Option                 | Type                                                | Default                                      | Description                                 |
| ---------------------- | --------------------------------------------------- | -------------------------------------------- | ------------------------------------------- |
| `gatewayApi`           | `RadixNetworkClient`                                | `createRadixNetworkClient({ networkId: 1 })` | The Radix network client to use             |
| `startStateVersion`    | `number`                                            | Current state version                        | The state version to start streaming from   |
| `numberOfTransactions` | `number`                                            | `100`                                        | Number of transactions to fetch per request |
| `debug`                | `boolean`                                           | `false`                                      | Enable debug logging                        |
| `logLevel`             | `'debug' \| 'info' \| 'warn' \| 'error' \| 'trace'` | `'debug'`                                    | Log level when debug is enabled             |

#### Returns

A transaction stream object with the following methods:

- `next()`: Fetches the next batch of transactions
- `setStateVersion(version: number)`: Manually set the current state version
- `getStateVersion()`: Get the current state version

### Transaction Result

The `next()` method returns a `Result` object (from the `neverthrow` library) that contains either:

#### Success Case

```typescript
{
  stateVersion: number;
  transactions: Transaction[];
}
```

Where `Transaction` is a transaction object from the Radix Gateway API.

#### Error Case

Various error types with appropriate context information.

## Error Handling

The transaction stream uses the `neverthrow` library for error handling, which means all operations return a `Result` type that must be checked.

Common errors include:

- `StateVersionBeyondEndOfKnownLedger`: Occurs when trying to fetch transactions beyond the current ledger state
- Network errors
- Gateway API errors

## License

MIT
