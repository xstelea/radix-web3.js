# TypeScript Radix Engine Toolkit Reference

TypeScript wrapper over the Radix Engine Toolkit WASM binary. Provides offline transaction building, signing, address derivation, SBOR encoding, and static validation for Radix DLT.

**Package:** `@radixdlt/radix-engine-toolkit` v1.0.6
**Source:** `.repos/typescript-radix-engine-toolkit/`
**License:** Apache 2.0
**Entry points:** ESM (`radix-engine-toolkit.mjs`), UMD (`radix-engine-toolkit.umd.js`)
**Key dependencies:** `@noble/ed25519`, `@noble/hashes`, `secp256k1`, `decimal.js`, `blakejs`

---

## Architecture — 3-Tier WASM Binding

```
RadixEngineToolkit (async static API)     ← User-facing, returns typed TS objects
        ↓
RawRadixEngineToolkit (WASM function map) ← Maps named WASM exports, error detection
        ↓
Host<Exports> (WASM host runtime)         ← Memory alloc/dealloc, JSON↔WASM serialization
        ↓
radix_engine_toolkit.wasm                 ← Rust-compiled WASM binary
```

**Communication protocol:** All data is serialized as JSON → UTF-8 encoded → null-terminated → written to WASM linear memory. Responses are read back using the same format and deserialized. The `RawRadixEngineToolkit` layer adds error detection — if the WASM returns `{ kind: "InvocationHandlingError" | "InvocationInterpretationError" }`, it throws.

**Initialization:** The WASM module is loaded once and exposed as `rawRadixEngineToolkit: Promise<RawRadixEngineToolkit>`. All high-level API methods `await` this promise internally.

Source: `src/wasm/host.ts`, `src/wasm/raw.ts`, `src/wasm/default.ts`

---

## RadixEngineToolkit — Static API

The primary API. All methods are `async` (they await WASM initialization). Organized as static nested classes on `RadixEngineToolkit`.

Source: `src/wasm/default.ts`

### RadixEngineToolkit.Build

```typescript
static async information(): Promise<BuildInformation>
// Returns { version: string, scryptoDependency: string }
```

### RadixEngineToolkit.Derive

| Method | Signature |
|--------|-----------|
| `virtualAccountAddressFromPublicKey` | `(publicKey: PublicKey, networkId: number) => Promise<string>` |
| `virtualIdentityAddressFromPublicKey` | `(publicKey: PublicKey, networkId: number) => Promise<string>` |
| `virtualAccountAddressFromOlympiaAccountAddress` | `(olympiaAddress: string, networkId: number) => Promise<string>` |
| `resourceAddressFromOlympiaResourceAddress` | `(olympiaResourceAddress: string, networkId: number) => Promise<string>` |
| `publicKeyFromOlympiaAccountAddress` | `(olympiaAddress: string) => Promise<Uint8Array>` |
| `olympiaAccountAddressFromPublicKey` | `(publicKey: Uint8Array, olympiaNetwork: OlympiaNetwork) => Promise<string>` |
| `nodeAddressFromPublicKey` | `(publicKey: Uint8Array, networkId: number) => Promise<string>` |
| `bech32mTransactionIdentifierFromIntentHash` | `(hash: Uint8Array, networkId: number) => Promise<string>` |

### RadixEngineToolkit.Instructions

| Method | Signature |
|--------|-----------|
| `convert` | `(instructions: Instructions, networkId: number, kind: "String" \| "Parsed") => Promise<Instructions>` |
| `compile` | `(instructions: Instructions, networkId: number) => Promise<Uint8Array>` |
| `decompile` | `(compiled: Uint8Array, networkId: number, kind?: "String" \| "Parsed") => Promise<Instructions>` |
| `extractAddresses` | `(instructions: Instructions, networkId: number) => Promise<Record<EntityType, string[]>>` |
| `staticallyValidate` | `(instructions: Instructions, networkId: number) => Promise<StaticValidationResult>` |

### RadixEngineToolkit.TransactionManifest

| Method | Signature |
|--------|-----------|
| `compile` | `(manifest: TransactionManifest, networkId: number) => Promise<Uint8Array>` |
| `decompile` | `(compiled: Uint8Array, networkId: number, kind?: "String" \| "Parsed") => Promise<TransactionManifest>` |
| `staticallyValidate` | `(manifest: TransactionManifest, networkId: number) => Promise<StaticValidationResult>` |

### RadixEngineToolkit.Intent

| Method | Signature |
|--------|-----------|
| `hash` / `intentHash` | `(intent: Intent) => Promise<TransactionHash>` |
| `compile` | `(intent: Intent) => Promise<Uint8Array>` |
| `decompile` | `(compiled: Uint8Array, kind?: "String" \| "Parsed") => Promise<Intent>` |
| `staticallyValidate` | `(intent: Intent, config: ValidationConfig) => Promise<StaticValidationResult>` |

### RadixEngineToolkit.SignedIntent

| Method | Signature |
|--------|-----------|
| `hash` / `signedIntentHash` | `(signedIntent: SignedIntent) => Promise<TransactionHash>` |
| `intentHash` | `(signedIntent: SignedIntent) => Promise<TransactionHash>` |
| `compile` | `(signedIntent: SignedIntent) => Promise<Uint8Array>` |
| `decompile` | `(compiled: Uint8Array, kind?: "String" \| "Parsed") => Promise<SignedIntent>` |
| `staticallyValidate` | `(signedIntent: SignedIntent, config: ValidationConfig) => Promise<StaticValidationResult>` |

### RadixEngineToolkit.NotarizedTransaction

| Method | Signature |
|--------|-----------|
| `hash` / `notarizedTransactionHash` | `(tx: NotarizedTransaction) => Promise<TransactionHash>` |
| `signedIntentHash` | `(tx: NotarizedTransaction) => Promise<TransactionHash>` |
| `intentHash` | `(tx: NotarizedTransaction) => Promise<TransactionHash>` |
| `compile` | `(tx: NotarizedTransaction) => Promise<Uint8Array>` |
| `decompile` | `(compiled: Uint8Array, kind?: "String" \| "Parsed") => Promise<NotarizedTransaction>` |
| `staticallyValidate` | `(tx: NotarizedTransaction, config: ValidationConfig) => Promise<StaticValidationResult>` |

### RadixEngineToolkit.ManifestSbor

```typescript
static async decodeToString(
  payload: Uint8Array,
  networkId: number,
  representation: ManifestSborStringRepresentation
): Promise<string>
```

### RadixEngineToolkit.ScryptoSbor

```typescript
static async decodeToString(
  payload: Uint8Array,
  networkId: number,
  representation: SerializationMode
): Promise<string>

static async encodeProgrammaticJson(object: any): Promise<Uint8Array>
```

### RadixEngineToolkit.Address

```typescript
static async entityType(address: string): Promise<EntityType>

static async decode(address: string): Promise<{
  networkId: number;
  entityType: EntityType;
  hrp: string;
  data: Uint8Array;
}>
```

### RadixEngineToolkit.Utils

```typescript
static async knownAddresses(networkId: number): Promise<KnownAddresses>
```

Returns well-known addresses for a network:
- `resourceAddresses`: xrd, secp256k1SignatureVirtualBadge, ed25519SignatureVirtualBadge, packageOfDirectCallerVirtualBadge, globalCallerVirtualBadge, systemTransactionBadge, packageOwnerBadge, validatorOwnerBadge, accountOwnerBadge, identityOwnerBadge
- `packageAddresses`: packagePackage, resourcePackage, accountPackage, identityPackage, consensusManagerPackage, accessControllerPackage, poolPackage, transactionProcessorPackage, metadataModulePackage, royaltyModulePackage, roleAssignmentModulePackage, genesisHelperPackage, faucetPackage
- `componentAddresses`: consensusManager, genesisHelper, faucet

### StaticValidationResult

```typescript
type StaticValidationResult =
  | { kind: "Valid" }
  | { kind: "Invalid"; error: string };
```

---

## LTSRadixEngineToolkit — Long-Term Support API

Simplified, stable API for common operations. Delegates to `RadixEngineToolkit` internally.

Source: `src/lts/toolkit.ts`

### LTSRadixEngineToolkit.Transaction

| Method | Signature |
|--------|-----------|
| `compile` | `(intent: CompilableIntent) => Promise<Uint8Array>` |
| `compileTransactionIntent` | `(intent: LTSTransactionIntent) => Promise<Uint8Array>` |
| `compileSignedTransactionIntent` | `(intent: LTSSignedTransactionIntent) => Promise<Uint8Array>` |
| `compileNotarizedTransactionIntent` | `(tx: LTSNotarizedTransaction) => Promise<Uint8Array>` |
| `summarizeTransaction` | `(tx: HasCompiledIntent \| Uint8Array) => Promise<TransactionSummary>` |

`summarizeTransaction` extracts fee locks, withdrawals, and deposits from simple transfer manifests. Only works with manifests created via `SimpleTransactionBuilder`.

### LTSRadixEngineToolkit.Derive

| Method | Signature |
|--------|-----------|
| `virtualAccountAddress` | `(publicKey: PublicKey, networkId: number) => Promise<string>` |
| `babylonAccountAddressFromOlympiaAccountAddress` | `(olympiaAddress: string, networkId: number) => Promise<OlympiaToBabylonAddressMapping>` |
| `babylonResourceAddressFromOlympiaResourceAddress` | `(olympiaResourceAddress: string, networkId: number) => Promise<string>` |
| `knownAddresses` | `(networkId: number) => Promise<AddressBook>` |
| `bech32mTransactionIdentifierFromIntentHash` | `(hash: Uint8Array, networkId: number) => Promise<string>` |

```typescript
interface AddressBook {
  resources: { xrdResource, secp256k1Resource, ed25519Resource, systemResource, packageBadgeResource: string };
  components: { faucet: string };
  packages: { faucet, account: string };
}
```

### LTSRadixEngineToolkit.Address

```typescript
static async isGlobalAccount(address: string): Promise<boolean>
static async isFungibleResource(address: string): Promise<boolean>
static async isNonFungibleResource(address: string): Promise<boolean>
```

### LTSRadixEngineToolkit.Utils

```typescript
static hash(data: Uint8Array): Uint8Array  // Blake2b-256, synchronous
```

### LTSRadixEngineToolkit.TestUtils

```typescript
static async createAccountWithDisabledDeposits(
  currentEpoch: number,
  networkId: number
): Promise<{ accountAddress: string; compiledNotarizedTransaction: CompiledNotarizedTransaction }>
```

---

## ManifestBuilder

Fluent builder for constructing `TransactionManifest` objects with parsed instructions. Uses a callback pattern for bucket/proof ID allocation — the callback receives the auto-incremented ID.

Source: `src/builder/manifest.ts`

### Worktop Instructions

```typescript
takeAllFromWorktop(resourceAddress: string, callback: (builder, bucketId: number) => this): this
takeFromWorktop(resourceAddress: string, amount: Decimal, callback: (builder, bucketId: number) => this): this
takeNonFungiblesFromWorktop(resourceAddress: string, ids: string[], callback: (builder, bucketId: number) => this): this
returnToWorktop(bucketId: number): this
```

### Worktop Assertions

```typescript
assertWorktopContainsAny(resourceAddress: string): this
assertWorktopContains(resourceAddress: string, amount: Decimal): this
assertWorktopContainsNonFungibles(resourceAddress: string, ids: string[]): this
```

### Auth Zone / Proof Instructions

```typescript
popFromAuthZone(callback: (builder, proofId: number) => this): this
pushToAuthZone(proofId: number): this
dropAuthZoneProofs(): this
dropAuthZoneSignatureProofs(): this
dropAllProofs(): this
createProofFromAuthZoneOfAmount(resourceAddress: string, amount: Decimal, callback: (builder, proofId: number) => this): this
createProofFromAuthZoneOfNonFungibles(resourceAddress: string, ids: string[], callback: (builder, proofId: number) => this): this
createProofFromAuthZoneOfAll(resourceAddress: string, callback: (builder, proofId: number) => this): this
createProofFromBucketOfAmount(bucketId: number, amount: Decimal, callback: (builder, proofId: number) => this): this
createProofFromBucketOfNonFungibles(bucketId: number, ids: string[], callback: (builder, proofId: number) => this): this
createProofFromBucketOfAll(bucketId: number, callback: (builder, proofId: number) => this): this
cloneProof(proofId: number, callback: (builder, proofId: number) => this): this
dropProof(proofId: number): this
```

### Invocation Instructions

All `address` parameters accept `string` (static bech32m address) or `number` (named address from `AllocateGlobalAddress`).

```typescript
callFunction(packageAddress: string | number, blueprintName: string, functionName: string, args: Value[]): this
callMethod(address: string | number, methodName: string, args: Value[]): this
callRoyaltyMethod(address: string | number, methodName: string, args: Value[]): this
callMetadataMethod(address: string | number, methodName: string, args: Value[]): this
callRoleAssignmentMethod(address: string | number, methodName: string, args: Value[]): this
callDirectVaultMethod(address: string, methodName: string, args: Value[]): this
```

### Other

```typescript
burnResource(bucketId: number): this
allocateGlobalAddress(packageAddress: string, blueprintName: string): this
build(): TransactionManifest
```

### Value Helper Functions

Exported helper functions for constructing `Value` objects used as method arguments:

```typescript
bool(value: boolean): Value
i8(value: number | string): Value
i16(value: number | string): Value
i32(value: number | string): Value
i64(value: number | bigint | string): Value
i128(value: number | bigint | string): Value
u8(value: number | string): Value
u16(value: number | string): Value
u32(value: number | string): Value
u64(value: number | bigint | string): Value
u128(value: number | bigint | string): Value
str(value: string): Value
enumeration(discriminator: number, ...fields: Value[]): Value
array(elementKind: ValueKind, ...elements: Value[]): Value
tuple(...fields: Value[]): Value
map(keyKind: ValueKind, valueKind: ValueKind, ...entries: [Value, Value][]): Value
address(value: string | number): Value    // string = Static, number = Named
bucket(value: number): Value
proof(value: number): Value
expression(value: "EntireWorktop" | "EntireAuthZone"): Value
decimal(value: number | bigint | string | Decimal): Value
preciseDecimal(value: number | bigint | string | Decimal): Value
blob(value: Bytes): Value
nonFungibleLocalId(value: string): Value
addressReservation(value: number): Value
```

---

## TransactionBuilder

Step-based builder for constructing notarized transactions. Supports both sync and async signing.

Source: `src/builder/transaction.ts`

### Flow

```
TransactionBuilder.new()          → TransactionBuilder
  .header(header)                 → TransactionBuilderManifestStep
  .message(message)               → TransactionBuilderManifestStep (optional)
  .plainTextMessage(text)         → TransactionBuilderManifestStep (optional)
  .manifest(manifest)             → TransactionBuilderIntentSignaturesStep
  .sign(source)                   → TransactionBuilderIntentSignaturesStep (repeatable)
  .signAsync(fn)                  → TransactionBuilderIntentSignaturesStep (repeatable)
  .notarize(source)               → Promise<NotarizedTransaction>
  .notarizeAsync(fn)              → Promise<NotarizedTransaction>
```

**SignatureSource<T>:** Can be a `Signer` object, a raw signature value, or a callback function `(messageHash: Uint8Array) => T`.

---

## SimpleTransactionBuilder

High-level builder for single-signer fungible transfers. Notary is the signer (`notaryIsSignatory: true`).

Source: `src/lts/builders.ts`

### Construction

```typescript
const builder = await SimpleTransactionBuilder.new({
  networkId: number,
  validFromEpoch: number,
  fromAccount: string,        // bech32m account address
  signerPublicKey: PublicKey,
});
```

### Configuration

```typescript
builder
  .nonce(n: number): this
  .feePayer(address: string): this                  // defaults to fromAccount
  .permanentlyRejectAfterEpochs(count: number): this // 1–100, default 2
  .tipPercentage(pct: number): this
  .lockedFee(amount: Amount): this                  // default 5 XRD
  .transferFungible({ toAccount, resourceAddress, amount }): this  // repeatable
```

### Compilation

```typescript
// No additional signatures (notary-only)
builder.compileIntent(): CompiledSignedTransactionIntent

// With intent signatures
builder.compileIntentWithSignatures(sources: SignatureSource<SignatureWithPublicKey>[]): CompiledSignedTransactionIntent

// Async intent signatures
builder.compileIntentWithSignaturesAsync(sources: SignatureFunction<Promise<SignatureWithPublicKey>>[]): Promise<CompiledSignedTransactionIntent>
```

### Faucet Helper

```typescript
const compiledTx = await SimpleTransactionBuilder.freeXrdFromFaucet({
  networkId: number,
  validFromEpoch: number,
  toAccount: string,  // receives 10,000 XRD
});
```

---

## Cryptographic Models

Source: `src/models/cryptographic/`

### PrivateKey

Abstract class with two concrete subclasses. Implements `Signer` interface.

```typescript
new PrivateKey.Secp256k1(bytes: Bytes)   // 32 bytes, uses secp256k1 npm
new PrivateKey.Ed25519(bytes: Bytes)     // 32 bytes, uses @noble/ed25519

// Common interface
privateKey.curve: Curve                   // "Secp256k1" | "Ed25519"
privateKey.bytes: Uint8Array
privateKey.publicKey(): PublicKey
privateKey.publicKeyBytes(): Uint8Array
privateKey.publicKeyHex(): string
privateKey.sign(messageHash: Uint8Array): Uint8Array
privateKey.signToSignature(messageHash: Uint8Array): Signature
privateKey.signToSignatureWithPublicKey(messageHash: Uint8Array): SignatureWithPublicKey
privateKey.produceSignature(messageHash: Uint8Array): SignerResponse
```

`Bytes` type: `Uint8Array | string` (hex string auto-converted).

### PublicKey

```typescript
new PublicKey.Secp256k1(bytes: Bytes)    // 33 bytes (compressed)
new PublicKey.Ed25519(bytes: Bytes)      // 32 bytes

publicKey.curve: Curve
publicKey.bytes: Uint8Array
publicKey.rawBytes(): Uint8Array
publicKey.hexString(): string
publicKey.hex(): string                   // alias
```

### Signature

```typescript
new Signature.Secp256k1(bytes: Bytes)    // 65 bytes (recid + r + s)
new Signature.Ed25519(bytes: Bytes)      // 64 bytes

signature.curve: Curve
signature.bytes: Uint8Array
```

### SignatureWithPublicKey

```typescript
new SignatureWithPublicKey.Secp256k1(signature: Bytes)
// publicKey is undefined — recoverable from secp256k1 signature

new SignatureWithPublicKey.Ed25519(signature: Bytes, publicKey: Bytes)
// publicKey required — ed25519 signatures are not recoverable
```

### Signer / SignerResponse

```typescript
interface Signer {
  produceSignature(messageHash: Uint8Array): SignerResponse;
}

interface AsyncSigner {
  produceSignature(messageHash: Uint8Array): Promise<SignerResponse>;
}

type SignerResponse = {
  curve: Curve;
  signature: Uint8Array;
  publicKey: Uint8Array;
};
```

### Key Length Constants

| Constant | Value |
|----------|-------|
| `ED25519_PRIVATE_KEY_LENGTH` | 32 |
| `SECP256K1_PRIVATE_KEY_LENGTH` | 32 |
| `ED25519_PUBLIC_KEY_LENGTH` | 32 |
| `SECP256K1_PUBLIC_KEY_LENGTH` | 33 |
| `ED25519_SIGNATURE_LENGTH` | 64 |
| `SECP256K1_SIGNATURE_LENGTH` | 65 |

---

## Transaction Models

Source: `src/models/transaction/`

### TransactionHeader

```typescript
interface TransactionHeader {
  networkId: number;
  startEpochInclusive: number;
  endEpochExclusive: number;
  nonce: number;
  notaryPublicKey: PublicKey;
  notaryIsSignatory: boolean;
  tipPercentage: number;
}
```

### Intent

```typescript
interface Intent {
  header: TransactionHeader;
  manifest: TransactionManifest;
  message: Message;
}
```

### TransactionManifest

```typescript
interface TransactionManifest {
  instructions: Instructions;
  blobs: Uint8Array[];
}
```

### Instructions

```typescript
type Instructions =
  | { kind: "String"; value: string }      // manifest string format
  | { kind: "Parsed"; value: Instruction[] }  // structured instruction array
```

### SignedIntent

```typescript
interface SignedIntent {
  intent: Intent;
  intentSignatures: SignatureWithPublicKey[];
}
```

### NotarizedTransaction

```typescript
interface NotarizedTransaction {
  signedIntent: SignedIntent;
  notarySignature: Signature;
}
```

### TransactionHash

```typescript
interface TransactionHash {
  hash: Uint8Array;   // raw 32-byte hash
  id: string;         // bech32m-encoded (e.g. "txid_rdx1...")
}
```

### Message

```typescript
type Message =
  | { kind: "None" }
  | { kind: "PlainText"; value: PlainTextMessage }
  | { kind: "Encrypted"; value: EncryptedMessage }

interface PlainTextMessage {
  mimeType: string;
  message: MessageContent;
}

type MessageContent =
  | { kind: "String"; value: string }
  | { kind: "Bytes"; value: Uint8Array }
```

### Instruction (Discriminated Union — 28 Variants)

Worktop: `TakeAllFromWorktop`, `TakeFromWorktop`, `TakeNonFungiblesFromWorktop`, `ReturnToWorktop`
Assertions: `AssertWorktopContainsAny`, `AssertWorktopContains`, `AssertWorktopContainsNonFungibles`
Auth zone: `PopFromAuthZone`, `PushToAuthZone`, `DropAuthZoneProofs`, `DropAuthZoneSignatureProofs`, `DropNamedProofs`, `DropAuthZoneRegularProofs`
Proofs: `CreateProofFromAuthZoneOfAmount`, `CreateProofFromAuthZoneOfNonFungibles`, `CreateProofFromAuthZoneOfAll`, `CreateProofFromBucketOfAmount`, `CreateProofFromBucketOfNonFungibles`, `CreateProofFromBucketOfAll`, `CloneProof`, `DropProof`
Invocations: `CallFunction`, `CallMethod`, `CallRoyaltyMethod`, `CallMetadataMethod`, `CallRoleAssignmentMethod`, `CallDirectVaultMethod`
Other: `BurnResource`, `DropAllProofs`, `AllocateGlobalAddress`

---

## Value System

Source: `src/models/value.ts`

### ValueKind Enum

```typescript
enum ValueKind {
  Bool, I8, I16, I32, I64, I128, U8, U16, U32, U64, U128,
  String, Enum, Array, Tuple, Map,
  Address, Bucket, Proof, Expression, Blob,
  Decimal, PreciseDecimal, NonFungibleLocalId, AddressReservation
}
```

`Value` is a discriminated union keyed on `kind: ValueKind`. See value helper functions in ManifestBuilder section.

### Expression Enum

```typescript
enum Expression {
  EntireWorktop = "EntireWorktop",
  EntireAuthZone = "EntireAuthZone",
}
```

---

## Convert Utility

Source: `src/convert.ts`

Static conversion methods organized by source type:

```typescript
Convert.String.toNumber(str: string): number
Convert.String.toBigInt(str: string): bigint
Convert.String.toDecimal(str: string): Decimal

Convert.Number.toString(num: number): string

Convert.Uint8Array.toHexString(array: Uint8Array): string

Convert.HexString.toUint8Array(str: string): Uint8Array

Convert.BigInt.toString(num: bigint): string

Convert.Decimal.toString(num: Decimal): string
```

---

## NetworkId Constants

Source: `src/network.ts`

```typescript
namespace NetworkId {
  Mainnet       = 0x01   // Production
  Stokenet      = 0x02   // Public testnet
  Alphanet      = 0x0A
  Betanet       = 0x0B
  Kisharnet     = 0x0C   // = RCNetV1
  Ansharnet     = 0x0D   // = RCNetV2
  Zabanet       = 0x0E   // = RCNetV3
  Gilganet      = 0x20
  Enkinet       = 0x21
  Hammunet      = 0x22
  Nergalnet     = 0x23
  Mardunet      = 0x24
  LocalNet      = 0xF0
  InternalTestNet = 0xF1
  Simulator     = 0xF2
}
```

---

## EntityType Enum

Source: `src/models/address/entity_type.ts`

```typescript
enum EntityType {
  GlobalPackage, GlobalConsensusManager, GlobalValidator,
  GlobalTransactionTracker, GlobalGenericComponent,
  GlobalAccount, GlobalIdentity, GlobalAccessController,
  GlobalOneResourcePool, GlobalTwoResourcePool, GlobalMultiResourcePool,
  GlobalAccountLocker,
  GlobalVirtualSecp256k1Account, GlobalVirtualSecp256k1Identity,
  GlobalVirtualEd25519Account, GlobalVirtualEd25519Identity,
  GlobalFungibleResourceManager, GlobalNonFungibleResourceManager,
  InternalFungibleVault, InternalNonFungibleVault,
  InternalGenericComponent, InternalKeyValueStore,
}
```

---

## LTS Transaction Wrappers

Source: `src/lts/transaction.ts`

Wrapper classes that implement `CompilableIntent` and `HasCompiledIntent` for use with `LTSRadixEngineToolkit.Transaction`.

### LTSTransactionIntent

```typescript
const intent = new LTSTransactionIntent({ header, manifest, message });
await intent.compile(): Uint8Array
await intent.transactionId(): TransactionHash
```

### LTSSignedTransactionIntent

```typescript
const signed = new LTSSignedTransactionIntent({ intent, intentSignatures });
await signed.compile(): Uint8Array
await signed.intentHash(): TransactionHash
await signed.signedIntentHash(): TransactionHash
```

### LTSNotarizedTransaction

```typescript
const notarized = new LTSNotarizedTransaction(notarizedTransaction);
await notarized.compile(): Uint8Array
await notarized.intentHash(): TransactionHash
await notarized.signedIntentHash(): TransactionHash
await notarized.notarizedPayloadHash(): TransactionHash
```

### CompiledSignedTransactionIntent

Intermediate object returned by `SimpleTransactionBuilder.compileIntent()`. Holds compiled signed intent bytes and provides notarization.

```typescript
compiled.hashToNotarize: Uint8Array          // signed intent hash bytes
compiled.transactionId: TransactionHash       // intent hash
compiled.toByteArray(): Uint8Array

compiled.compileNotarized(source: SignatureSource<Signature>): CompiledNotarizedTransaction
compiled.compileNotarizedAsync(fn: (hash) => Promise<Signature>): Promise<CompiledNotarizedTransaction>
compiled.summarizeTransaction(): Promise<TransactionSummary>
```

### CompiledNotarizedTransaction

Final compiled transaction ready for submission.

```typescript
compiled.compiled: Uint8Array
compiled.intentHash: TransactionHash
compiled.notarizedPayloadHash: TransactionHash

compiled.toByteArray(): Uint8Array
compiled.toHex(): string
compiled.intentHashHex(): string
compiled.transactionIdHex(): string
compiled.notarizedPayloadHashHex(): string
compiled.staticallyValidate(networkId: number): Promise<TransactionValidity>
compiled.summarizeTransaction(): Promise<TransactionSummary>
```

### TransactionSummary

```typescript
interface TransactionSummary {
  feesLocked: { account: string; amount: Decimal };
  withdraws: Record<string, Record<string, Decimal>>;  // account → resource → amount
  deposits: Record<string, Record<string, Decimal>>;
}
```

---

## Utility Functions

Source: `src/utils.ts`

```typescript
hash(data: Uint8Array): Uint8Array        // Blake2b-256 (synchronous)
generateRandomNonce(): number              // Math.random() * 0xFFFFFFFF
```

---

## Usage Patterns

### Derive Account Address from Key

```typescript
import { RadixEngineToolkit, PrivateKey, NetworkId } from "@radixdlt/radix-engine-toolkit";

const privateKey = new PrivateKey.Ed25519("deadbeef...");
const accountAddress = await RadixEngineToolkit.Derive.virtualAccountAddressFromPublicKey(
  privateKey.publicKey(),
  NetworkId.Mainnet
);
```

### Build and Submit a Fungible Transfer

```typescript
import {
  SimpleTransactionBuilder, PublicKey, NetworkId
} from "@radixdlt/radix-engine-toolkit";

const builder = await SimpleTransactionBuilder.new({
  networkId: NetworkId.Stokenet,
  validFromEpoch: currentEpoch,
  fromAccount: "account_tdx_2_...",
  signerPublicKey: new PublicKey.Ed25519("..."),
});

const compiled = builder
  .transferFungible({
    toAccount: "account_tdx_2_...",
    resourceAddress: "resource_tdx_2_...",
    amount: "100",
  })
  .compileIntent()
  .compileNotarized(privateKey);

// Submit compiled.toByteArray() to Gateway API
```

### Build a Custom Transaction with ManifestBuilder

```typescript
import {
  ManifestBuilder, TransactionBuilder, NetworkId,
  decimal, bucket, enumeration, generateRandomNonce,
} from "@radixdlt/radix-engine-toolkit";

const manifest = new ManifestBuilder()
  .callMethod(accountAddress, "lock_fee", [decimal("10")])
  .callMethod(accountAddress, "withdraw", [
    address(xrdAddress),
    decimal("100"),
  ])
  .takeFromWorktop(xrdAddress, new Decimal("100"), (builder, bucketId) =>
    builder.callMethod(recipientAddress, "try_deposit_or_abort", [
      bucket(bucketId),
      enumeration(0),
    ])
  )
  .build();

const notarized = await TransactionBuilder.new().then((builder) =>
  builder
    .header({
      networkId: NetworkId.Stokenet,
      startEpochInclusive: currentEpoch,
      endEpochExclusive: currentEpoch + 10,
      nonce: generateRandomNonce(),
      notaryPublicKey: privateKey.publicKey(),
      notaryIsSignatory: true,
      tipPercentage: 0,
    })
    .manifest(manifest)
    .sign(privateKey)
    .notarize(privateKey)
);

const compiled = await RadixEngineToolkit.NotarizedTransaction.compile(notarized);
```

### Get Free XRD from Faucet (Testnet)

```typescript
import { SimpleTransactionBuilder, NetworkId } from "@radixdlt/radix-engine-toolkit";

const compiled = await SimpleTransactionBuilder.freeXrdFromFaucet({
  networkId: NetworkId.Stokenet,
  validFromEpoch: currentEpoch,
  toAccount: "account_tdx_2_...",
});
// Submit compiled.toByteArray() — deposits 10,000 XRD
```

### Decode and Validate a Compiled Transaction

```typescript
const tx = await RadixEngineToolkit.NotarizedTransaction.decompile(compiledBytes);
const result = await RadixEngineToolkit.NotarizedTransaction.staticallyValidate(
  tx, defaultValidationConfig(NetworkId.Mainnet)
);
if (result.kind === "Invalid") throw new Error(result.error);
```

### Address Inspection

```typescript
const entityType = await RadixEngineToolkit.Address.entityType("account_rdx1...");
// EntityType.GlobalVirtualEd25519Account

const decoded = await RadixEngineToolkit.Address.decode("account_rdx1...");
// { networkId: 1, entityType: ..., hrp: "account_rdx", data: Uint8Array }

const isAccount = await LTSRadixEngineToolkit.Address.isGlobalAccount("account_rdx1...");
// true
```
