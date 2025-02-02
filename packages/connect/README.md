# Radix Connect

A TypeScript library for connecting dApps to the Radix Wallet.

## Installation

```bash
npm install radix-connect
```

## Usage

### Basic Example

```typescript
import {
  createRadixConnectClient,
  createRadixConnectRelayTransport,
} from 'radix-connect'

// Create transport
const transport = createRadixConnectRelayTransport({
  handleRequest: async ({ deepLink }) => {
    // Handle the deeplink (e.g. show QR code)
    console.log(deepLink)
  },
})

// Create client
const client = createRadixConnectClient({ transport })

// Send request to wallet
const response = await client.sendRequest({
  interactionId: crypto.randomUUID(),
  metadata: {
    version: 2,
    networkId: 1,
    dAppDefinitionAddress: 'account_rdx...',
    origin: 'https://your-dapp.com',
  },
  items: {
    discriminator: 'authorizedRequest',
    auth: {
      discriminator: 'loginWithChallenge',
      challenge: '...',
    },
  },
})
```

### API

#### createRadixConnectClient(options)

Creates a client instance for interacting with the Radix Wallet.

Options:

- `transport`: Transport implementation for sending requests

#### createRadixConnectRelayTransport(options)

Creates a transport client for communicating with the wallet over Radix Connect Relay.

Options:

- (optional) `baseUrl`: Relay server URL (default: https://radix-connect-relay.radixdlt.com)
- (optional) `walletUrl`: Wallet deep link URL (default: radixWallet://connect)
- (optional) `sessionId`: Custom session ID (default: random UUID)
- (optional) `privateKey`: Custom private key for Diffie-Hellman key exchange (default: randomly generated)
- `handleRequest`: Callback function to handle wallet requests

The transport uses Diffie-Hellman key exchange to establish a shared secret between the dApp and wallet. This enables end-to-end encrypted communication over the relay server.

```mermaid
sequenceDiagram
    participant D as dApp
    participant R as Radix Connect Relay
    participant W as Radix Wallet

    Note over D,W: Initial Request
    D->>D: Create wallet interaction
    D->>D: Sign interaction with ed25519
    D->>D: Generate deeplink

    Note over D,W: User Connection
    D->>W: User opens deeplink
    W->>W: Generate DH keypair
    W->>W: Process request
    W->>W: Calculate shared secret
    W->>W: Encrypt response with AES-GCM
    W->>R: POST encrypted response

    Note over D: Polling Loop
    loop Until response received or timeout
        D->>R: POST getResponses(sessionId)
        R->>D: Return response
    end

    Note over D: Process Response
    D->>D: Calculate shared secret
    D->>D: Decrypt response with AES-GCM
    D->>D: Verify interactionId matches
```
