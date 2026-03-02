# @radix-effects/tx-tool — Radix Transaction Builder

Effect-TS library for building, signing, and submitting Radix transactions. Provides a service-based architecture with dependency injection via Effect layers, covering the full transaction lifecycle from manifest creation through network submission and status polling.

**Source:** `.repos/radix-web3.js/packages/tx-tool/src/`
**Dependencies (workspace):** `@radix-effects/gateway`, `@radix-effects/shared`
**Dependencies (external):** `effect`, `@effect/platform`, `@effect/platform-node`, `@radixdlt/radix-engine-toolkit`, `@radixdlt/babylon-gateway-api-sdk`, `@radixdlt/babylon-core-api-sdk`, `@noble/curves`, `bignumber.js`

---

## Mental Model

Every capability is an **Effect Service** — a class extending `Effect.Service` with a `dependencies` array and an `effect` factory. The Effect runtime resolves the dependency graph automatically, constructing each service with its requirements satisfied. This gives you compile-time safety: if a layer is missing, TypeScript catches it.

Two extension points use **`Context.Tag`** (injectable interfaces):

- **`Signer`** — how transactions get signed (Vault vs. private key)
- **`TransactionLifeCycleHook`** — optional observer for transaction events

You compose layers to wire the application. Swap `Signer.VaultLive` for `Signer.makePrivateKeySigner(key)` without changing any business logic. Omit `TransactionLifeCycleHook` entirely — it's consumed via `Effect.serviceOption`, so it's genuinely optional.

---

## Transaction Lifecycle Flow

```
 manifest string                   TransactionHelper.submitTransaction()
 ─────┬─────                       ════════════════════════════════════
      │
  1.  │  addFeePayer?              ManifestHelper adds lock_fee instructions
      │  (secured vs unsecurified)  (creates proof for securified accounts)
      │
  2.  │  CreateTransactionIntent   Parses manifest, builds header (epoch, nonce,
      │                            notary key), validates manifest statically
      │
  3.  │  IntentHashService         Hashes intent → TransactionId + hash bytes
      │
  4.  │  EpochService              Verifies current epoch is within bounds
      │
  5.  │  Signer                    Signs the intent hash → Ed25519 signatures
      │
  6.  │  CompileTransaction        Notarizes (notary signs) + compiles to bytes
      │
      │  ── hook: onSubmit ──
      │
  7.  │  SubmitTransaction         POSTs compiled hex to Gateway API
      │
      │  ── hook: onSubmitSuccess ──
      │
  8.  │  TransactionStatus.poll    Exponential backoff polling until
      │                            CommittedSuccess / CommittedFailure /
      │                            PermanentlyRejected / Timeout
      │
      │  ── hook: onStatusFailure (on error) ──
      │  ── hook: onSuccess (on success) ──
      │
      ▼
  { statusResponse, id }
```

---

## Architecture Overview

| Service                      | Purpose                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `TransactionHelper`          | High-level orchestrator — `submitTransaction`, `submitTransactionV2`, `faucet`, `createBadge`, `createFungibleToken`, `getCommittedDetails` |
| `CreateTransactionIntent`    | Builds a V1 `TransactionIntent` from manifest string + optional epoch/message overrides                                                     |
| `CreateTransactionIntentV2`  | Builds a V2 `TransactionIntentV2` from manifest string + optional epoch/message/timestamp overrides                                         |
| `TransactionHeader`          | Generates transaction header with epoch bounds, nonce, notary public key                                                                    |
| `CompileTransaction`         | Notarizes intent with signatures, compiles to `Uint8Array` for submission                                                                   |
| `IntentHashService`          | Hashes `TransactionIntent`/`TransactionIntentV2` → `{ id: TransactionId, hash: HexString }`                                                 |
| `EpochService`               | Queries current epoch from Gateway, validates epoch bounds                                                                                  |
| `SubmitTransaction`          | Submits compiled transaction hex to Gateway API                                                                                             |
| `TransactionStatus`          | Polls transaction status with exponential backoff and timeout                                                                               |
| `StaticallyAnalyzeManifest`  | Analyzes manifest classification/entities using Radix Engine Toolkit                                                                        |
| `StaticallyValidateManifest` | Validates manifest against Radix Engine Toolkit before submission                                                                           |
| `PreviewTransaction`         | Previews transaction via Gateway without submitting                                                                                         |
| `NotaryKeyPair`              | Wraps `Signer` to produce notary `Signature` (not `SignatureWithPublicKey`)                                                                 |
| `ManifestHelper`             | Service wrapper for `addFeePayer` manifest builder                                                                                          |
| `Signer`                     | `Context.Tag` — signing abstraction with two implementations                                                                                |
| `TransactionLifeCycleHook`   | `Context.Tag` — optional observer for transaction lifecycle events                                                                          |
| `Vault`                      | HashiCorp Vault transit engine integration for signing                                                                                      |

---

## Core Types (schemas.ts)

All types are **Effect Schema**-driven — they validate at boundaries and transform between wire/domain formats.

### TransactionIntent

```typescript
const TransactionIntentSchema = Schema.Struct({
  header: TransactionHeaderSchema,
  message: TransactionMessageSchema,
  manifest: ManifestSchema,
});
```

### TransactionHeader

```typescript
const TransactionHeaderSchema = Schema.Struct({
  networkId: NetworkId,
  startEpochInclusive: Epoch,
  endEpochExclusive: Epoch,
  notaryPublicKey: Ed25519PublicKeySchema, // HexString → PublicKey.Ed25519
  nonce: Nonce,
  notaryIsSignatory: Schema.Boolean,
  tipPercentage: Schema.Number,
});
```

### Manifest

Transforms `TransactionManifestString` → `{ instructions: { kind: "String", value }, blobs: Uint8Array[] }`.

### TransactionMessage

Transforms `Option<TransactionMessageString>` → `PlainTextMessage | { kind: "None" }`. Supports `text/plain` MIME type.

### Key/Signature Types

| Type                            | Schema                                | Transforms                                                                                                  |
| ------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `Ed25519PublicKey`              | `Ed25519PublicKeySchema`              | `HexString` → `PublicKey.Ed25519` instance                                                                  |
| `Ed25519PrivateKey`             | `Ed25519PrivateKeySchema`             | `HexString` → `PrivateKey.Ed25519` instance                                                                 |
| `Ed25519SignatureWithPublicKey` | `Ed25519SignatureWithPublicKeySchema` | `{ signature: HexString, signerPublicKey: HexString, curve: "Ed25519" }` → `SignatureWithPublicKey.Ed25519` |

### Badge

```typescript
const BadgeSchema = Schema.Struct({
  type: Schema.Literal("fungibleResource"),
  resourceAddress: FungibleResourceAddress,
});
```

### Encoding Helpers

| Schema                | Purpose                      |
| --------------------- | ---------------------------- |
| `Base64FromHexSchema` | `HexString` → `Base64String` |
| `HexFromBase64Schema` | `Base64String` → `HexString` |

---

## TransactionHelper (High-Level API)

`TransactionHelper` is the main orchestrator. It extends `Effect.Service` with 9 declared dependencies. Additionally, `Signer`, `TransactionLifeCycleHook`, and `GatewayApiClient` are resolved from context at runtime (not in the `dependencies` array).

### Methods

| Method                | Input                                                | Returns                            | Description                                                                                                                                                       |
| --------------------- | ---------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `submitTransaction`   | `{ manifest, feePayer?, transactionIntent? }`        | `{ statusResponse, id }`           | Full lifecycle: build intent → sign → compile → submit → poll. Optionally accepts a pre-built `TransactionIntent`. Checks XRD balance if `feePayer` is specified. |
| `faucet`              | `{ account: Account }`                               | `{ statusResponse, id }`           | Calls testnet faucet to fund an account. Dies with `FaucetNotAvailableError` on mainnet (networkId 1).                                                            |
| `createBadge`         | `{ account, feePayer, initialSupply? }`              | `FungibleResourceAddress`          | Creates a fungible badge resource, submits, then fetches committed details to extract the new resource address. Default supply: 1.                                |
| `createFungibleToken` | `{ account, feePayer, name, symbol, initialSupply }` | `FungibleResourceAddress`          | Creates a named fungible token with symbol and initial supply. Extracts resource address from committed details.                                                  |
| `getCommittedDetails` | `{ id: TransactionId }`                              | Gateway committed details response | Fetches committed transaction details from Gateway API.                                                                                                           |

### submitTransaction Details

- If `feePayer` is provided, checks the account's XRD balance at current ledger state and fails with `InsufficientXrdBalanceError` if balance is too low
- If `transactionIntent` is not provided, creates one (adding fee payer instructions, building header, validating manifest)
- If `transactionIntent` is provided, hashes it and verifies epoch bounds without rebuilding
- Lifecycle hooks fire at each stage (all optional)

---

## TransactionLifeCycleHook

Optional observer pattern using `Context.Tag`. Consumed via `Effect.serviceOption` — omit it entirely if you don't need lifecycle callbacks.

```typescript
class TransactionLifeCycleHook extends Context.Tag("TransactionLifeCycleHook")<
  TransactionLifeCycleHook,
  {
    onSubmit?: (input: {
      id: TransactionId;
      intent: TransactionIntent;
    }) => Effect.Effect<void, never, never>;
    onSubmitSuccess?: (input: {
      id: TransactionId;
      intent: TransactionIntent;
    }) => Effect.Effect<void, never, never>;
    onStatusFailure?: (input: {
      id: TransactionId;
      permanent: boolean;
      intent: TransactionIntent;
    }) => Effect.Effect<void, never, never>;
    onSuccess?: (input: {
      id: TransactionId;
    }) => Effect.Effect<void, never, never>;
  }
>() {}
```

| Callback          | Fires When                                   | Notable Fields                                                 |
| ----------------- | -------------------------------------------- | -------------------------------------------------------------- |
| `onSubmit`        | Just before network submission               | `id`, `intent`                                                 |
| `onSubmitSuccess` | After successful submission (before polling) | `id`, `intent`                                                 |
| `onStatusFailure` | Polling detects failure or timeout           | `id`, `intent`, `permanent` (true if `TransactionFailedError`) |
| `onSuccess`       | Transaction committed successfully           | `id`                                                           |

---

## Signer Abstraction

`Signer` is a `Context.Tag` defining the signing interface. Two implementations are provided.

### Interface

```typescript
class Signer extends Context.Tag('Signer')<
  Signer,
  {
    signToSignatureWithPublicKey: (hash: HexString) =>
      Effect.Effect<Ed25519SignatureWithPublicKey[], FailedToSignTransactionError, never>;
    publicKey: () => Effect.Effect<PublicKey, never, never>;
  }
>() { ... }
```

### Implementations

| Implementation                     | Usage                        | How It Works                                                                                                                                                                                                                |
| ---------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Signer.VaultLive`                 | Production — HashiCorp Vault | Calls Vault transit engine `POST /v1/transit/sign/{keyName}` for signatures, `GET /v1/transit/keys/{keyName}` for public key. Reads token from `VAULT_TOKEN_FILE` or `VAULT_TOKEN`. Provides `Vault.Default` automatically. |
| `Signer.makePrivateKeySigner(key)` | Development/testing          | Takes a `Redacted<HexString>` private key. Signs in-process using `PrivateKey.Ed25519`. Returns a `Layer` — use `Layer.provide(Signer.makePrivateKeySigner(key))`.                                                          |

### Vault Configuration

| Variable           | Default                   | Purpose                                                                               |
| ------------------ | ------------------------- | ------------------------------------------------------------------------------------- |
| `VAULT_KEY_NAME`   | `'xrd-distribution'`      | Transit engine key name                                                               |
| `VAULT_BASE_URL`   | `'http://localhost:8200'` | Vault server URL                                                                      |
| `VAULT_TOKEN_FILE` | —                         | Path to file containing Vault token (preferred in production, written by Vault Agent) |
| `VAULT_TOKEN`      | —                         | Fallback: Vault token as environment variable                                         |

---

## Manifest Builders

### `faucet(accountAddress)`

Generates manifest that first locks 10 XRD fee from the faucet component, then calls faucet `"free"` method, then deposits to the given account. Returns `Effect` (needs `knownAddresses` lookup). Hardcoded to network ID 2 (stokenet).

### `createBadge(account, initialSupply?)`

Creates a fungible resource with name `"Badge"`, configurable `initialSupply` (default 1), deposits to account. Uses `CREATE_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY` with restrictive access rules.

### `createFungibleTokenManifest({ name, symbol, initialSupply, account })`

Creates a named fungible token with `DenyAll` on most roles except deposit/withdraw (`AllowAll`). Sets metadata for `name` and `symbol`. Deposits initial supply to account.

### `addFeePayer({ account, amount })` (standalone function)

Generates `lock_fee` manifest instructions. Handles two account types:

| Account Type          | Manifest Generated                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| `unsecurifiedAccount` | Direct `CALL_METHOD` → `"lock_fee"` on the account                                                  |
| Securified account    | `CALL_METHOD` → `"create_proof"` on access controller, then `CALL_METHOD` → `"lock_fee"` on account |

### `ManifestHelper.addFeePayer({ account, amount })`

Service wrapper (`Effect.Service`) around the same fee payer logic. Used internally by `TransactionHelper.submitTransaction`.

---

## Individual Services Reference

| Service                      | Purpose                                                                                                                                                    | Key Errors                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `CreateTransactionIntent`    | Builds `TransactionIntent` from manifest + optional epoch/message. Parses input via Schema, builds header, validates manifest statically.                  | `InvalidEpochError`, `InvalidManifestError`, `FailedToStaticallyValidateManifestError`, `ParseError` |
| `CreateTransactionIntentV2`  | Builds `TransactionIntentV2` from manifest + optional epoch/message/timestamps. Parses input via Schema, builds V2 headers, validates manifest statically. | `InvalidEpochError`, `InvalidManifestError`, `FailedToStaticallyValidateManifestError`, `ParseError` |
| `CompileTransaction`         | Notarizes intent (notary signs hash), compiles to `Uint8Array`. Uses `TransactionBuilder` from Radix Engine Toolkit.                                       | `FailedToNotarizeTransactionError`, `FailedToCompileTransactionError`                                |
| `TransactionHeader`          | Generates header with current epoch bounds (default window: current to current+2), random nonce, notary public key.                                        | `InvalidEpochError`                                                                                  |
| `IntentHashService`          | Hashes `TransactionIntent` → `{ id: TransactionId, hash: HexString }` using `RadixEngineToolkit.Intent.hash`.                                              | `FailedToCreateIntentHashError`                                                                      |
| `EpochService`               | `getCurrentEpoch()` queries Gateway ledger state. `verifyEpochBounds()` validates a transaction's epoch window against current epoch.                      | `InvalidStartEpochError`, `InvalidEndEpochError`                                                     |
| `SubmitTransaction`          | Converts compiled `Uint8Array` to hex, POSTs to Gateway `transactionSubmit`.                                                                               | Gateway API errors                                                                                   |
| `TransactionStatus`          | `poll({ id })` queries `transactionStatus` endpoint with exponential backoff. Retries on `TransactionNotResolvedError`, stops on success/failure/timeout.  | `TransactionNotResolvedError`, `TransactionFailedError`, `TimeoutError`                              |
| `StaticallyAnalyzeManifest`  | Calls `RadixEngineToolkit.TransactionManifest.staticallyAnalyze`. Returns static manifest analysis output for inspection/logging/policy checks.            | `FailedToStaticallyAnalyzeManifestError`                                                             |
| `StaticallyValidateManifest` | Calls `RadixEngineToolkit.TransactionManifest.staticallyValidate`. Rejects manifests before network submission.                                            | `FailedToStaticallyValidateManifestError`, `InvalidManifestError`                                    |
| `PreviewTransaction`         | Calls Gateway `transactionPreview`. Returns full preview result if receipt status is `Succeeded`.                                                          | `TransactionPreviewError`                                                                            |
| `NotaryKeyPair`              | Wraps `Signer` — delegates `publicKey()` directly, converts `signToSignatureWithPublicKey` → single `Signature.Ed25519` for notarization.                  | (inherits from Signer)                                                                               |

---

## Error Types

All errors use Effect's `Data.TaggedError` pattern — each has a unique `_tag` for `Effect.catchTags` pattern matching.

| Error                                     | `_tag`                                      | Source                       | Fields                                                    |
| ----------------------------------------- | ------------------------------------------- | ---------------------------- | --------------------------------------------------------- |
| `InvalidEpochError`                       | `'InvalidEpochError'`                       | `TransactionHeader`          | `message`                                                 |
| `InvalidStartEpochError`                  | `'InvalidStartEpochError'`                  | `EpochService`               | `message`, `transactionId`                                |
| `InvalidEndEpochError`                    | `'InvalidEndEpochError'`                    | `EpochService`               | `message`, `transactionId`                                |
| `InvalidManifestError`                    | `'InvalidManifestError'`                    | `StaticallyValidateManifest` | `message`                                                 |
| `FailedToStaticallyAnalyzeManifestError`  | `'FailedToStaticallyAnalyzeManifestError'`  | `StaticallyAnalyzeManifest`  | `error`                                                   |
| `FailedToStaticallyValidateManifestError` | `'FailedToStaticallyValidateManifestError'` | `StaticallyValidateManifest` | `error`                                                   |
| `FailedToCreateIntentHashError`           | `'FailedToCreateIntentHashError'`           | `IntentHashService`          | `error`                                                   |
| `FailedToCompileTransactionError`         | `'FailedToCompileTransactionError'`         | `CompileTransaction`         | `error`                                                   |
| `FailedToNotarizeTransactionError`        | `'FailedToNotarizeTransactionError'`        | `CompileTransaction`         | `error`                                                   |
| `FailedToSignTransactionError`            | `'FailedToSignTransactionError'`            | `Signer`                     | `error`                                                   |
| `TransactionNotResolvedError`             | `'TransactionNotResolvedError'`             | `TransactionStatus`          | `status`, `statusDescription`, `message`, `transactionId` |
| `TransactionFailedError`                  | `'TransactionFailedError'`                  | `TransactionStatus`          | `status`, `statusDescription`, `message`, `transactionId` |
| `TimeoutError`                            | `'TimeoutError'`                            | `TransactionStatus`          | `transactionId`                                           |
| `TransactionPreviewError`                 | `'TransactionPreviewError'`                 | `PreviewTransaction`         | `message?` (internal — not exported)                      |
| `FaucetNotAvailableError`                 | `'FaucetNotAvailableError'`                 | `TransactionHelper`          | `message`                                                 |
| `InsufficientXrdBalanceError`             | `'InsufficientXrdBalanceError'`             | `TransactionHelper`          | `message`                                                 |

---

## Configuration

All configuration uses Effect's `Config` module — reads from environment variables.

| Variable                                     | Default                   | Service             | Purpose                                            |
| -------------------------------------------- | ------------------------- | ------------------- | -------------------------------------------------- |
| `VAULT_KEY_NAME`                             | `'xrd-distribution'`      | `Vault`             | Transit engine key name                            |
| `VAULT_BASE_URL`                             | `'http://localhost:8200'` | `Vault`             | Vault server URL                                   |
| `VAULT_TOKEN_FILE`                           | —                         | `Vault`             | Path to Vault token file (preferred in production) |
| `VAULT_TOKEN`                                | —                         | `Vault`             | Vault token (fallback when no token file)          |
| `TRANSACTION_STATUS_POLL_TIMEOUT`            | `Duration.minutes(1)`     | `TransactionStatus` | Max time to poll before `TimeoutError`             |
| `TRANSACTION_STATUS_MAX_POLL_ATTEMPTS_COUNT` | `10`                      | `TransactionStatus` | Max retry attempts                                 |
| `TRANSACTION_STATUS_POLL_DELAY`              | `Duration.millis(100)`    | `TransactionStatus` | Initial exponential backoff delay                  |

---

## Test Helpers

### `createAccount(input?)`

Generates an Ed25519 keypair and derives a virtual account address. Returns `{ address, sign, publicKeyHex, privateKeyHex }`. Optional `privateKey` and `networkId` (default 1) overrides. Uses `@noble/curves/ed25519` for key generation and `RadixEngineToolkit.Derive.virtualAccountAddressFromPublicKey` for address derivation.

### `DisableTestClock(effect)`

Wraps an Effect that uses time-dependent operations (like `TransactionStatus.poll` with its exponential backoff) in a test context. Forks the effect, then repeatedly advances Effect's `TestClock` by 1 second and polls the fiber until completion. Essential for testing services that use `Schedule` or `Duration`-based timeouts.
