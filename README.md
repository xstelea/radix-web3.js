# Radix Web3.js Monorepo

A collection of JavaScript/TypeScript packages for interacting with the Radix Network.

👉 [See docs](https://xstelea.github.io/radix-web3.js/)

## Getting Started

```bash
npm install radix-web3.js
```

## Quick Example

```typescript
import { createEd25519KeyPair, createRadixWeb3Client } from 'radix-web3.js'
import { sendResourceManifest } from 'radix-web3.js/manifests'
import { fromPublicKey } from 'radix-web3.js/account'

// Create a new keypair
const keyPair = createEd25519KeyPair()

// Initialize the client
const web3Client = createRadixWeb3Client({
  networkId: 'Stokenet',
  notaryPublicKey: keyPair.publicKey(),
  notarizer: (hash) => keyPair.signToSignature(hash),
})

// Get your account address
const accountAddress = await fromPublicKey(keyPair.publicKey(), 2) // 2 = Stokenet

// Send 1 XRD to another address
const { transactionId } = await web3Client.submitTransaction(
  sendResourceManifest({
    resourceAddress:
      'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc',
    amount: '1',
    fromAddress: accountAddress,
    toAddress: 'account_tdx_2_12yf3qp4feqnw...',
  }),
)

// Check your balances
const { fungibleTokens } = await web3Client.getBalances(accountAddress)
console.log('Balances:', fungibleTokens)
```

## Packages

### Core [@radix-web3/core](./packages/core)

Core functionality for building and submitting transactions, managing accounts and keypairs.

### Account [@radix-web3/account](./packages/account)

Account management and address derivation utilities.

### Manifests [@radix-web3/manifests](./packages/manifests)

Transaction manifest building and utilities.
