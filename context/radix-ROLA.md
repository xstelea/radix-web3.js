# Radix Off-Ledger Authentication (ROLA)

Challenge-response authentication library for verifying Radix Wallet identity claims. ROLA proves that a user controls the accounts/personas they present to your dApp by verifying cryptographic signatures against on-ledger `owner_keys` metadata. Runs server-side ("off-ledger") alongside backend business logic. TypeScript and Python implementations.

**Source:** `.repos/rola/typescript/src/` (TypeScript), `.repos/rola/python/rola/` (Python)
**Dependencies (TS):** `neverthrow`, `@noble/curves`, `@radixdlt/radix-engine-toolkit`, `@radixdlt/babylon-gateway-api-sdk`
**Dependencies (Py):** `radix-engine-toolkit`, `ed25519`, `ecdsa`, `requests`

---

## Mental Model

ROLA answers one question: "Does this user actually control the account/persona they claim to own?"

The Radix Wallet signs a challenge with the private key associated with an account or persona. The server verifies the signature using the public key, then confirms that public key is associated with the claimed address — either via on-ledger `owner_keys` metadata or by deriving the virtual address from the public key.

This is **not** session management or authorization. ROLA only authenticates identity claims. Your backend handles sessions, permissions, and business logic after ROLA confirms the signature is valid.

---

## Verification Flow

```
 Client (dApp)                  Server                     Radix Gateway
 ─────────────                  ──────                     ─────────────
      │                            │                            │
  1.  │──── GET /create-challenge ─▶│                            │
      │                            │ generate random 32 bytes   │
      │                            │ store with expiration       │
  2.  │◀──── { challenge } ────────│                            │
      │                            │                            │
      │ Wallet signs challenge     │                            │
      │ with account/persona key   │                            │
      │                            │                            │
  3.  │──── POST /verify ─────────▶│                            │
      │  [SignedChallenge[]]       │                            │
      │                            │                            │
  4.  │                            │ verify challenge not       │
      │                            │ expired, delete from store │
      │                            │                            │
  5.  │                            │ for each SignedChallenge:  │
      │                            │  a. build signature msg    │
      │                            │  b. verify signature       │
      │                            │  c. hash public key        │
      │                            │  d. derive virtual address │
      │                            │                            │
  6.  │                            │── GET /state/entity/details ▶│
      │                            │   (query owner_keys)       │
      │                            │◀── owner_keys metadata ────│
      │                            │                            │
      │                            │ if owner_keys set:         │
      │                            │   hash must be in keys     │
      │                            │ if owner_keys NOT set:     │
      │                            │   derived addr must match  │
      │                            │                            │
  7.  │◀──── { valid: true } ──────│                            │
```

### Two-Path Validation (Step 6)

After signature verification, ROLA must confirm the public key belongs to the claimed address. Two paths:

| Condition | Validation | When This Happens |
|---|---|---|
| `owner_keys` metadata is set | Public key hash must appear in the `owner_keys` array | Securified accounts, accounts with explicit key rotation |
| `owner_keys` metadata is empty/missing | Virtual address derived from public key must equal the claimed address | Newly-created virtual accounts that haven't set metadata |

This dual path ensures ROLA works for both brand-new virtual accounts (no on-ledger metadata yet) and securified accounts that have rotated keys.

---

## Cryptographic Internals

### Signature Message Construction

The message that gets signed is a blake2b hash of a structured payload:

```
┌─────────────────────────────────────────────────────────┐
│ "R" (1 byte, ASCII 0x52)                                │
│ challenge (32 bytes, raw)                                │
│ length_of_dapp_address (1 byte, hex-encoded length)      │
│ dapp_definition_address (UTF-8 encoded bech32 address)   │
│ origin (UTF-8 encoded, e.g. "https://mydapp.com")        │
└─────────────────────────────────────────────────────────┘
         │
         ▼
  blake2b(payload, digest_size=32) → signature_message_hex
```

TypeScript implementation (`create-signature-message.ts`):

```typescript
const messageBuffer = Buffer.concat([
  Buffer.from('R', 'ascii'),              // prefix
  Buffer.from(challenge, 'hex'),           // 32 raw challenge bytes
  Buffer.from(dAppDefAddress.length.toString(16), 'hex'), // 1-byte length
  Buffer.from(dAppDefinitionAddress, 'utf-8'),
  Buffer.from(origin, 'utf-8'),
])
return blake2b(messageBuffer) // → hex string
```

Python implementation (`helpers.py`):

```python
message = b"".join([
    "R".encode(),                                          # prefix
    challenge,                                             # 32 raw bytes
    len(dapp_definition_address).to_bytes(1, "big"),       # 1-byte length
    bytes([ord(c) for c in dapp_definition_address]),
    bytes([ord(c) for c in origin]),
])
hashlib.blake2b(message, digest_size=32).hexdigest()
```

The Python impl validates that challenge is exactly 32 bytes and dApp address is exactly 69 chars. The TypeScript impl delegates validation to the caller.

### Curve Support

| Curve | TypeScript Key | Library | Signature Handling |
|---|---|---|---|
| Ed25519 (curve25519) | `'curve25519'` | `@noble/curves/ed25519` | Direct verify: `ed25519.verify(signature, message, publicKey)` |
| secp256k1 | `'secp256k1'` | `@noble/curves/secp256k1` | Strip first 2 chars (recovery byte): `signature.slice(2)`, then verify |

In Python: `ed25519.VerifyingKey` for curve25519, `ecdsa.VerifyingKey.from_string(curve=SECP256k1)` for secp256k1.

### Public Key Hashing

Used to compare the proof's public key against on-ledger `owner_keys`:

```typescript
// create-public-key-hash.ts
blake2b(Buffer.from(publicKey, 'hex'))
  .map((hash) => hash.subarray(-29))  // last 29 bytes
  .map((hash) => Buffer.from(hash).toString('hex'))
```

```python
# helpers.py
hashed = blake2b(public_key, digest_size=32).digest()
result = hashed[-29:]  # last 29 bytes
hex_encoded = result.hex()
```

The last 29 bytes of the blake2b-256 hash of the raw public key bytes. This matches the format stored in on-ledger `owner_keys` metadata.

### Address Derivation

When `owner_keys` is not set, ROLA derives the expected virtual address from the public key to compare against the claimed address:

| Type + Curve | Derivation Function |
|---|---|
| `persona` (any curve) | `RadixEngineToolkit.Derive.virtualIdentityAddressFromPublicKey(Ed25519(pk))` |
| `account` + `curve25519` | `RadixEngineToolkit.Derive.virtualAccountAddressFromPublicKey(Ed25519(pk))` |
| `account` + `secp256k1` | `RadixEngineToolkit.Derive.virtualAccountAddressFromPublicKey(Secp256k1(pk))` |

In Python, uses `derive_virtual_identity_address_from_public_key` and `derive_virtual_account_address_from_public_key` from `radix_engine_toolkit`.

---

## TypeScript API

### `Rola(input: RolaInput)`

Factory function. Returns `{ verifySignedChallenge }`.

```typescript
import { Rola, SignedChallenge, RolaError } from '@radixdlt/rola'

const { verifySignedChallenge } = Rola({
  expectedOrigin: 'https://mydapp.com',
  dAppDefinitionAddress: 'account_rdx1...',
  applicationName: 'My dApp',
  networkId: 1,                    // 1 = mainnet, 2 = stokenet
  gatewayApiClient: optionalClient // override default Gateway client
})
```

### `RolaInput`

```typescript
type RolaInput = {
  expectedOrigin: string           // must match wallet request origin
  dAppDefinitionAddress: string    // on-ledger dApp definition account
  applicationName: string          // identifies your app to the Gateway
  networkId: number                // Radix network ID
  gatewayApiClient?: GatewayApiClient // optional: custom SDK client
}
```

### `SignedChallenge`

The proof payload sent from the wallet via the dApp:

```typescript
type SignedChallenge = {
  address: string                  // account or persona address
  type: 'persona' | 'account'
  challenge: string                // hex-encoded 32-byte challenge
  proof: {
    publicKey: string              // hex-encoded public key
    signature: string              // hex-encoded signature
    curve: 'curve25519' | 'secp256k1'
  }
}
```

### `verifySignedChallenge(signedChallenge): ResultAsync<void, RolaError>`

Returns a `neverthrow` `ResultAsync`. Does not throw — use `.isOk()` / `.isErr()`.

```typescript
const result = await verifySignedChallenge(signedChallenge)

if (result.isOk()) {
  // Authenticated — public key is confirmed to belong to the address
}

if (result.isErr()) {
  console.log(result.error.reason) // one of the error reasons below
}
```

### `RolaError`

```typescript
type RolaError = { reason: string; jsError?: Error }
```

### Error Reasons

| `reason` | Cause |
|---|---|
| `'couldNotHashPublicKey'` | blake2b hash of public key failed |
| `'unsupportedCurve'` | Curve is not `curve25519` or `secp256k1` |
| `'couldNotHashMessage'` | blake2b hash of signature message failed |
| `'invalidSignature'` | Signature does not verify against public key |
| `'invalidPublicKey'` | Public key verification threw (malformed key), or key not found on-ledger and derived address doesn't match |
| `'couldNotDeriveAddressFromPublicKey'` | `RadixEngineToolkit` address derivation failed |
| `'couldNotVerifyPublicKeyOnLedger'` | Gateway API call to fetch `owner_keys` failed |

### Verification Pipeline

The internal verification order (each step short-circuits on failure):

```
1. createPublicKeyHash(proof.publicKey)           → hashed public key
2. createSignatureMessage(challenge, dApp, origin) → signature message hex
3. verifyProof(signedChallenge, signatureMessage)  → signature valid?
4. deriveVirtualAddress(signedChallenge, networkId) → derived address
   queryLedger(address) → { ownerKeysMatchesProvidedPublicKey, ownerKeysSet }
   (steps 4a and 4b run in parallel via ResultAsync.combine)
5. if ownerKeysSet → ownerKeysMatchesProvidedPublicKey must be true
   if !ownerKeysSet → derivedAddress must equal signedChallenge.address
```

---

## Python API

### `Rola` Class

```python
from rola.core import Rola
from rola.utils.gateway import GatewayMetadataProvider
from rola.models.signed_challenge import SignedChallenge
from rola.models.proof import Proof
from rola.models.challenge import ChallengeType

rola = Rola(
    network_id=1,
    dapp_address="account_rdx1...",
    expected_origin="https://mydapp.com",
    application_name="My dApp",
    gateway_metadata_provider=GatewayMetadataProvider.for_mainnet(),
)

result: bool = rola.verify_signed_challenge(signed_challenge)
```

Unlike the TypeScript version (which returns `ResultAsync`), the Python version returns `bool` — `True` if verified, `False` otherwise. Exceptions are caught internally and return `False`.

### `GatewayMetadataProvider`

Queries Gateway `/state/entity/details` for `owner_keys` metadata:

```python
class GatewayMetadataProvider:
    def __init__(self, base_url: str = "https://mainnet.radixdlt.com")

    @classmethod
    def for_mainnet(cls) -> "GatewayMetadataProvider"

    @classmethod
    def for_stokenet(cls) -> "GatewayMetadataProvider"

    def entity_owner(self, address: str) -> List[PublicKeyHash]
```

Returns parsed `PublicKeyHash` values from `owner_keys` metadata with type `"PublicKeyHashArray"`. Raises `EntityNotFound` if the entity doesn't exist on-ledger.

### Models

```python
class Proof:
    public_key: bytes       # raw key bytes
    signature: bytes        # raw signature bytes
    curve: Curve            # radix_engine_toolkit.Curve (ED25519 or SECP256K1)

class ChallengeType(Enum):
    PERSONA = 1
    ACCOUNT = 2

class SignedChallenge:
    challenge: bytes        # 32 raw bytes
    proof: Proof
    address: str            # bech32 address
    challenge_type: ChallengeType

    def verify_signature(self, signature_message: bytes) -> bool
```

### Exceptions

| Exception | When |
|---|---|
| `EntityNotFound` | Gateway returns no items for the address |
| `ChallengeWrongLength` | Challenge is not exactly 32 bytes |
| `DappAddressWrongLength` | dApp definition address is not 69 chars |

---

## Gateway Integration

ROLA queries entity metadata to check if a public key is associated with an address.

### TypeScript: `GatewayService`

```typescript
const gatewayService = GatewayService({
  networkId: 1,
  applicationName: 'My dApp',
  gatewayApiClient: optionalClient,
})
```

Calls `state.getEntityDetailsVaultAggregated(address)`, then extracts:

```typescript
response.metadata.items
  .find((item) => item.key === 'owner_keys')
  ?.value.raw_hex ?? ''
```

Returns the raw hex of the `owner_keys` metadata value. Comparison is case-insensitive (`.toUpperCase()` on both sides).

### Python: `GatewayMetadataProvider`

Calls `POST /state/entity/details` with `{"addresses": [address]}`, then parses the response to extract `owner_keys` values with type `"PublicKeyHashArray"`.

---

## Integration Pattern

### Challenge Store

Challenges must be:
1. **Cryptographically random** — 32 bytes from a CSPRNG
2. **Single-use** — deleted after verification attempt
3. **Time-limited** — expire after a short window (e.g. 5 minutes)
4. **Server-generated** — never trust client-provided challenges

```typescript
// In-memory example (use a database in production)
const ChallengeStore = () => {
  const challenges = new Map<string, { expires: number }>()

  const create = () => {
    const challenge = secureRandom(32) // 32 random bytes as hex
    const expires = Date.now() + 1000 * 60 * 5
    challenges.set(challenge, { expires })
    return challenge
  }

  const verify = (input: string) => {
    const challenge = challenges.get(input)
    if (!challenge) return false
    challenges.delete(input) // single-use: delete immediately
    return challenge.expires > Date.now()
  }

  return { create, verify }
}
```

### Express Server Example

```typescript
import { Rola, SignedChallenge } from '@radixdlt/rola'
import { ResultAsync } from 'neverthrow'

const { verifySignedChallenge } = Rola({
  applicationName: 'My dApp',
  dAppDefinitionAddress: 'account_tdx_2_12yf9gd53yfep7a669fv2t3wm7nz9zeezwd04n02a433ker8vza6rhe',
  networkId: 2,
  expectedOrigin: 'http://localhost:4000',
})

app.get('/create-challenge', (req, res) => {
  res.send({ challenge: challengeStore.create() })
})

app.post('/verify', async (req, res) => {
  const signedChallenges: SignedChallenge[] = req.body

  // 1. Verify all challenges are valid (not expired, single-use)
  const challenges = [...new Set(signedChallenges.map((sc) => sc.challenge))]
  const allChallengesValid = challenges.every((c) => challengeStore.verify(c))
  if (!allChallengesValid) return res.send({ valid: false })

  // 2. Verify all signed challenges cryptographically
  const result = await ResultAsync.combine(
    signedChallenges.map((sc) => verifySignedChallenge(sc))
  )

  if (result.isErr()) return res.send({ valid: false })
  res.send({ valid: true })
})
```

### Client-Side (Radix dApp Toolkit)

The client requests proofs from the wallet and sends them to the server:

```typescript
import { RadixDappToolkit, DataRequestBuilder } from '@radixdlt/radix-dapp-toolkit'

const rdt = RadixDappToolkit({ dAppDefinitionAddress: '...', networkId: 2 })

// Request proofs with the data request
rdt.walletApi.setRequestData(
  DataRequestBuilder.persona().withProof(),
  DataRequestBuilder.accounts().atLeast(1).withProof(),
)

// Provide challenge generator — called by RDT before each wallet request
rdt.walletApi.provideChallengeGenerator(() =>
  fetch('/create-challenge').then((r) => r.json()).then((r) => r.challenge)
)

// Handle proofs when wallet responds
rdt.walletApi.dataRequestControl(async ({ proofs }) => {
  const { valid } = await fetch('/verify', {
    method: 'POST',
    body: JSON.stringify(proofs),
    headers: { 'content-type': 'application/json' },
  }).then((r) => r.json())
})
```

---

## Common Mistakes

### 1. Challenge Reuse or Missing Expiration

Challenges must be single-use and time-limited. Reusing challenges or skipping expiration enables replay attacks. Always delete from the store on first verification attempt (even if verification fails).

### 2. Origin Mismatch

`expectedOrigin` must match the origin the Radix Wallet used when signing. A mismatch between your server config and the actual client origin silently produces invalid signatures. Common cause: `http://localhost:4000` vs `http://localhost:3000`, or missing protocol prefix.

### 3. Ignoring the Two-Path Validation

If you only check `owner_keys` and skip the derived-address fallback, verification fails for new virtual accounts that haven't set metadata yet. Both paths must be checked: `owner_keys` match OR derived address match (when `owner_keys` is empty).

### 4. Not Handling Multiple Signed Challenges

A single wallet response can contain multiple `SignedChallenge` objects (one per account + one for the persona). All must be verified. Use `ResultAsync.combine` (TS) to verify them in parallel and short-circuit on any failure.

### 5. Client-Generated Challenges

Never accept challenges generated on the client. The server must generate and store them. Client-generated challenges defeat the purpose of the challenge-response protocol since an attacker could reuse a previously-captured signature.

### 6. secp256k1 Recovery Byte

In TypeScript, secp256k1 signatures include a recovery byte prefix (first 2 hex chars). The verification code strips this: `signature.slice(2)`. If you implement custom verification, ensure you handle this.

---

## Quick Reference

### TypeScript Types

| Type | Key Fields |
|---|---|
| `RolaInput` | `expectedOrigin`, `dAppDefinitionAddress`, `applicationName`, `networkId`, `gatewayApiClient?` |
| `SignedChallenge` | `address`, `type: 'persona' \| 'account'`, `challenge`, `proof: { publicKey, signature, curve }` |
| `RolaError` | `reason: string`, `jsError?: Error` |

### Python Classes

| Class | Module |
|---|---|
| `Rola` | `rola.core` |
| `SignedChallenge` | `rola.models.signed_challenge` |
| `Proof` | `rola.models.proof` |
| `ChallengeType` | `rola.models.challenge` |
| `GatewayMetadataProvider` | `rola.utils.gateway` |

### Key Functions

| Function | Purpose |
|---|---|
| `Rola()` (TS) / `Rola()` (Py) | Factory/class — creates verifier with config |
| `verifySignedChallenge` (TS) / `verify_signed_challenge` (Py) | Core verification — returns `ResultAsync<void, RolaError>` (TS) or `bool` (Py) |
| `createSignatureMessage` / `create_signature_message` | Builds `"R" + challenge + addr_len + addr + origin` → blake2b hash |
| `createPublicKeyHash` / `create_public_key_hash` | blake2b of public key → last 29 bytes hex |
| `deriveVirtualAddress` / `derive_address` | Public key → virtual account/persona address |

### Error Reasons (TypeScript)

| Reason | Stage |
|---|---|
| `couldNotHashPublicKey` | Public key hashing |
| `unsupportedCurve` | Signature verification |
| `couldNotHashMessage` | Signature message construction |
| `invalidSignature` | Cryptographic verification |
| `invalidPublicKey` | Key parsing or on-ledger validation |
| `couldNotDeriveAddressFromPublicKey` | Address derivation |
| `couldNotVerifyPublicKeyOnLedger` | Gateway API call |
