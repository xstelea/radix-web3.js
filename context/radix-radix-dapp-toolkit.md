# Radix dApp Toolkit — Deep Analysis

## Overview

`@radixdlt/radix-dapp-toolkit` (RDT) is the official TypeScript SDK for integrating Radix Wallet into web dApps. It handles wallet connection, account/persona sharing, transaction signing, pre-authorization (subintents), and all transport-layer communication.

Key properties:

- **Factory pattern** — `RadixDappToolkit(options)` wires modules, returns `walletApi`, `buttonApi`, `gatewayApi`
- **Dual transport** — Connector Extension (desktop, CustomEvent) + Radix Connect Relay (mobile, deep link + REST polling)
- **Reactive state** — RxJS Observables for wallet data, button status, request items
- **Error handling** — `neverthrow` ResultAsync throughout; typed SdkError with discriminated ErrorType
- **Schema validation** — Valibot for wallet interaction request/response validation
- **E2E encryption** — Curve25519 ECDH + AES-GCM for relay transport

**Source:** `.repos/radix-dapp-toolkit/packages/dapp-toolkit/src/` (119 TS files)
**Dependencies:** `rxjs`, `neverthrow`, `valibot`, `immer`, `@noble/curves`, `blakejs`, `lit`, `tslog`

---

## Monorepo Structure

```
radix-dapp-toolkit/                 (Turborepo, npm workspaces)
├── packages/
│   ├── common/                     radix-connect-common — shared types (Account, RequestItem, ButtonStatus/Theme enums)
│   ├── connect-button/             @radixdlt/connect-button — Lit web component <radix-connect-button>
│   └── dapp-toolkit/               @radixdlt/radix-dapp-toolkit — main SDK
├── examples/
│   ├── simple-dapp/                Vite + TS reference dApp
│   └── cdn/                        UMD single-file bundle usage
└── docs/                           Protocol docs, migration guides, sequence diagrams
```

Build: `tsup` (ESM+CJS dual) + `vite` (UMD bundle). Tests: `vitest` + jsdom.

---

## Module Architecture

```
RadixDappToolkit (factory)
├── WalletRequestModule (576 LOC, central orchestrator)
│   ├── WalletRequestSdk — creates WalletInteraction, selects transport, validates schema
│   ├── Transport Layer
│   │   ├── ConnectorExtensionModule — CustomEvent dispatch/listen
│   │   └── RadixConnectRelayModule — deep link + REST polling (1.5s)
│   ├── EncryptionModule — AES-GCM + Curve25519 ECDH key exchange
│   ├── IdentityModule — ed25519/x25519 keypairs, signatures
│   ├── SessionModule — session lifecycle, IndexedDB persistence
│   ├── DataRequestStateModule — pending data request configuration
│   ├── RequestItemModule — request tracking (pending→success/fail/ignored)
│   ├── RequestResolverModule — match responses to requests
│   └── PreauthorizationPollingModule — poll subintent status (1s)
├── StateModule — RdtState (walletData, sharedData, loggedInTimestamp)
├── StorageModule — localStorage persistence, partitioned by dAppAddress+networkId
├── GatewayModule — transaction/subintent status polling, wraps Gateway API
├── ConnectButtonModule — bridges to <radix-connect-button> web component
└── EnvironmentModule — platform detection (browser/Node)
```

---

## Main Entry Point

```typescript
// Factory
const rdt = RadixDappToolkit(options: RadixDappToolkitOptions)

// Returns:
{
  walletApi: WalletApi          // Core wallet interaction
  buttonApi: ButtonApi          // Connect button UI control
  gatewayApi: { clientConfig }  // Gateway configuration for external use
  disconnect(): void            // Log out user
  destroy(): void               // Full cleanup
}
```

### RadixDappToolkitOptions

| Field                   | Type                                                | Required | Notes                                                       |
| ----------------------- | --------------------------------------------------- | -------- | ----------------------------------------------------------- |
| `networkId`             | `number`                                            | Yes      | `RadixNetwork.Stokenet` (2), `.Mainnet` (1)                 |
| `dAppDefinitionAddress` | `string`                                            | Yes      | On-ledger dApp definition account                           |
| `applicationName`       | `string`                                            | No       | Identifies dApp in wallet                                   |
| `applicationVersion`    | `string`                                            | No       |                                                             |
| `useCache`              | `boolean`                                           | No       | Default true; skip wallet UI for repeat requests            |
| `gatewayBaseUrl`        | `string`                                            | No       | Override gateway URL                                        |
| `logger`                | `Logger`                                            | No       | Custom logger                                               |
| `onDisconnect`          | `() => void`                                        | No       | Disconnect callback                                         |
| `explorer`              | `ExplorerConfig`                                    | No       | `{ baseUrl, transactionPath, subintentPath, accountsPath }` |
| `requestInterceptor`    | `(WalletInteraction) => Promise<WalletInteraction>` | No       | Modify outgoing requests                                    |
| `providers`             | `Partial<Providers>`                                | No       | DI overrides for all modules                                |
| `featureFlags`          | `string[]`                                          | No       | Experimental features                                       |

---

## WalletApi

### Data Requests (accounts, personas, proofs)

```typescript
// Configure persistent request (shown on connect button click)
walletApi.setRequestData(
  DataRequestBuilder.accounts().atLeast(1),
  DataRequestBuilder.persona().withProof(),
  DataRequestBuilder.personaData()
    .isRequestingName()
    .numberOfRequestedEmailAddresses({ quantifier: 'atLeast', quantity: 1 })
)

// Trigger configured request
walletApi.sendRequest(): WalletDataRequestResult

// One-time request (not persisted)
walletApi.sendOneTimeRequest(
  OneTimeDataRequestBuilder.accounts().atLeast(1)
): WalletDataRequestResult

// One-time proof of ownership
walletApi.sendOneTimeRequest(
  OneTimeDataRequestBuilder.proofOfOwnership()
    .accounts(['account_rdx...'])
    .identity('identity_rdx...')
)

// Refresh shared accounts
walletApi.updateSharedAccounts(): WalletDataRequestResult
```

### Transaction Sending

```typescript
const result = await walletApi.sendTransaction({
  transactionManifest: string,   // RTM manifest
  version?: number,              // Default 1
  blobs?: string[],              // Binary blobs
  message?: string,              // User-facing message
  onTransactionId?: (txId: string) => void
}): SendTransactionResult
// → ResultAsync<{ transactionIntentHash, status: TransactionStatus }, SdkError>
```

### Pre-Authorization (Subintents)

```typescript
const result = await walletApi.sendPreAuthorizationRequest({
  // Built with SubintentRequestBuilder:
  SubintentRequestBuilder()
    .manifest(subintentManifest)
    .setExpiration('atTime', unixTimestamp)   // or 'afterDelay', seconds
    .addBlobs(...)
    .message('Sign to pre-authorize')
    .toRequestItem()
}): ResultAsync<{ signedPartialTransaction: string }, SdkError>
```

### State & Callbacks

```typescript
// Reactive wallet state
walletApi.walletData$: Observable<WalletDataState>
walletApi.getWalletData(): WalletDataState | undefined

// ROLA challenge generator
walletApi.provideChallengeGenerator(async () => fetchChallengeFromBackend())

// Intercept/validate wallet response before state update
walletApi.dataRequestControl(async (walletData) => { /* validate, throw to reject */ })

// Callback after connect response processed
walletApi.provideConnectResponseCallback((result) => { /* handle login */ })
```

---

## Key Types

### WalletDataState

```typescript
{
  accounts: { address: string, label: string, appearanceId: number }[]
  personaData: (
    | { entry: 'fullName', fields: { variant: 'western'|'eastern', familyName, givenNames, nickname } }
    | { entry: 'emailAddresses', fields: string[] }
    | { entry: 'phoneNumbers', fields: string[] }
  )[]
  proofs: SignedChallenge[]
  persona?: { identityAddress: string, label: string }
}
```

### SignedChallenge / Proof

```typescript
SignedChallenge = {
  type: 'persona' | 'account'
  challenge: string
  proof: { publicKey: string, signature: string, curve: 'curve25519' | 'secp256k1' }
  address: string
}
```

### SdkError

```typescript
{
  error: string           // ErrorType discriminator
  interactionId: string
  message?: string
  jsError?: unknown
}
```

### ErrorType (all values)

`rejectedByUser`, `missingExtension`, `canceledByUser`, `walletRequestValidation`, `walletResponseValidation`, `wrongNetwork`, `failedToPrepareTransaction`, `failedToCompileTransaction`, `failedToSignTransaction`, `failedToSubmitTransaction`, `failedToPollSubmittedTransaction`, `submittedTransactionWasDuplicate`, `submittedTransactionHasFailedTransactionStatus`, `submittedTransactionHasRejectedTransactionStatus`, `failedToFindAccountWithEnoughFundsToLockFee`, `wrongAccountType`, `unknownWebsite`, `radixJsonNotFound`, `unknownDappDefinitionAddress`, `invalidPersona`

---

## Wallet Interaction Protocol

### Message Schema

```typescript
WalletInteraction = {
  interactionId: string (UUID)
  metadata: { version: 2, networkId, dAppDefinitionAddress, origin }
  items: WalletInteractionItems
}

// Items discriminated union:
| { discriminator: 'authorizedRequest', auth, reset?, proofOfOwnership?, oneTimeAccounts?, ongoingAccounts?, oneTimePersonaData?, ongoingPersonaData? }
| { discriminator: 'unauthorizedRequest', oneTimeAccounts?, oneTimePersonaData? }
| { discriminator: 'transaction', send: { transactionManifest, version, blobs?, message? } }
| { discriminator: 'cancelRequest', interactionId }
| { discriminator: 'preAuthorizationRequest', subintent: SubintentRequestItem }
```

### Response Schema

```typescript
// Success
{ discriminator: 'success', interactionId, items: WalletInteractionResponseItems }

// Failure
{ discriminator: 'failure', interactionId, error: string, message?: string }
```

---

## Transport Layer

### Connector Extension (Desktop)

- Sends via `window.dispatchEvent(new CustomEvent('radix#chromeExtension#send', { detail }))`
- Receives via `addEventListener('radix#chromeExtension#receive', handler)`
- Status check: `extensionStatus` interaction → `{ isWalletLinked, isExtensionAvailable, canHandleSessions }`
- Message lifecycle: `receivedByExtension` → `receivedByWallet` → response
- Session wrapping optional (if extension `canHandleSessions`)

### Radix Connect Relay (Mobile)

- Deep link: `radixWallet://connect?sessionId=...&request=...&signature=...&publicKey=...&identity=...&origin=...&dAppDefinitionAddress=...`
- Request base64url-encoded, signed with ed25519
- Response polling: `GET radix-connect-relay.radixdlt.com/api/v1/sessions/{sessionId}` every 1.5s
- Responses encrypted with AES-GCM (Curve25519 ECDH shared secret, HKDF-SHA256, salt=dAppDefinitionAddress, info='RCfM')
- SealBox format: `[IV 12B][Ciphertext][AuthTag 16B]`

---

## GatewayModule

```typescript
GatewayModule(input): {
  pollTransactionStatus(txIntentHash): ResultAsync<TransactionStatus, SdkError>
  pollSubintentStatus(subintentHash, expirationTimestamp): {
    stop: () => void
    result: ResultAsync<{ subintentStatus, transactionIntentHash }, SdkError>
  }
  gatewayApi: GatewayApiService
  configuration: GatewayApiClientConfig
}
```

`TransactionStatus`: `'Unknown' | 'CommittedSuccess' | 'CommittedFailure' | 'Pending' | 'Rejected'`

`GatewayApiService`: `getTransactionStatus()`, `getSubintentStatus()`, `getEntityMetadataPage()`

---

## ButtonApi

```typescript
{
  setMode(value: 'light' | 'dark'): void
  setTheme(value: RadixButtonTheme): void
  status$: Observable<RadixButtonStatus>
}
```

`RadixButtonTheme`: `'radix-blue' | 'black' | 'white-with-outline' | 'white' | 'custom'`
`RadixButtonStatus`: `'pending' | 'success' | 'error' | 'default'`

---

## Connect Button Web Component

`<radix-connect-button>` — Lit-based custom element. Framework-agnostic.

Key properties: `theme`, `dAppName`, `personaLabel`, `connected`, `status`, `requestItems`, `accounts`, `personaData`, `isMobile`, `isWalletLinked`, `isExtensionAvailable`, `mode`, `avatarUrl`

Events: `onConnect`, `onDisconnect`, `onCancelRequestItem`, `onIgnoreTransactionItem`, `onShowPopover`, `onUpdateSharedAccounts`, `onDestroy`

---

## Networks

```typescript
RadixNetwork = {
  Mainnet: 0x01,
  Stokenet: 0x02,
  Gilganet: 0x20,
  Enkinet: 0x21,
  Hammunet: 0x22,
  Nergalnet: 0x23,
  Mardunet: 0x24,
  Dumunet: 0x25,
};
```

---

## Storage

localStorage partitioned as `rdt:{dAppDefinitionAddress}:{networkId}/`:

- `state/` — walletData, personas, proofs
- `requests/` — pending request metadata
- `connectorExtension/` — sessionId
- Custom partitions via `getPartition()`

---

## Design Patterns

| Pattern               | Usage                                                                  |
| --------------------- | ---------------------------------------------------------------------- |
| Factory + DI          | `RadixDappToolkit(options)` with `providers` overrides                 |
| Reactive streams      | RxJS `Observable`, `BehaviorSubject`, `Subject`                        |
| Result monad          | `neverthrow` `ResultAsync<T, E>` — `.map()`, `.andThen()`, `.mapErr()` |
| Schema validation     | `valibot` schemas for all wallet protocol messages                     |
| Immutable state       | `immer` for state updates                                              |
| Builder pattern       | `DataRequestBuilder`, `SubintentRequestBuilder`                        |
| Transport abstraction | `TransportProvider` interface with `isSupported()`, `send()`           |
