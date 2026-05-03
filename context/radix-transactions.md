# Radix Transactions Crate Reference

Technical reference for the `radix-transactions` Rust crate (v1.4.0-dev) from radixdlt-scrypto. This is the canonical library for building, signing, validating, and serializing Radix transactions.

## Crate Structure

All source paths relative to `radix-transactions/src/`.

| Module        | Purpose                                                                    |
| ------------- | -------------------------------------------------------------------------- |
| `builder/`    | Transaction and manifest builders                                          |
| `data/`       | Data conversion, formatting, transformation                                |
| `errors/`     | Error types (header, signature, manifest, validation)                      |
| `manifest/`   | Instructions, compiler, decompiler, lexer, parser, AST, static interpreter |
| `model/`      | All transaction types (V1, V2), execution model, hashing, preparation      |
| `signing/`    | `Signer` trait and `PrivateKey` enum                                       |
| `validation/` | Transaction validator, config, signature validation, structure validation  |

**Public prelude** re-exports `builder::*`, `model::*`, `signing::{PrivateKey, Signer}`.

**Key dependencies:** `sbor` (serialization), `radix-common` (with `secp256k1_sign_and_validate`), `radix-engine-interface`, `radix-rust`.

## Transaction Model

### V1: Flat Layered Architecture

```
NotarizedTransactionV1
├── SignedIntentV1
│   ├── IntentV1
│   │   ├── TransactionHeaderV1
│   │   ├── InstructionsV1
│   │   ├── BlobsV1
│   │   └── MessageV1
│   └── IntentSignaturesV1  (Vec<IntentSignatureV1>)
└── NotarySignatureV1
```

**TransactionHeaderV1:**

| Field                   | Type        | Description                     |
| ----------------------- | ----------- | ------------------------------- |
| `network_id`            | `u8`        | Network discriminator           |
| `start_epoch_inclusive` | `Epoch`     | Validity window start           |
| `end_epoch_exclusive`   | `Epoch`     | Validity window end             |
| `nonce`                 | `u32`       | Uniqueness nonce                |
| `notary_public_key`     | `PublicKey` | Notary's public key             |
| `notary_is_signatory`   | `bool`      | Whether notary counts as signer |
| `tip_percentage`        | `u16`       | Validator tip (0–65535%)        |

### V2: Tree Structure with Subintents

```
NotarizedTransactionV2
├── SignedTransactionIntentV2
│   ├── TransactionIntentV2
│   │   ├── TransactionHeaderV2
│   │   ├── IntentCoreV2  (root intent)
│   │   │   ├── IntentHeaderV2
│   │   │   ├── BlobsV1
│   │   │   ├── MessageV2
│   │   │   ├── ChildSubintentSpecifiersV2
│   │   │   └── InstructionsV2
│   │   └── NonRootSubintentsV2  (Vec<SubintentV2>, flattened)
│   ├── IntentSignaturesV2  (for root intent)
│   └── NonRootSubintentSignaturesV2  (one IntentSignaturesV2 per subintent)
└── NotarySignatureV2
```

**TransactionHeaderV2** (simplified vs V1):

| Field                 | Type        | Note                                     |
| --------------------- | ----------- | ---------------------------------------- |
| `notary_public_key`   | `PublicKey` |                                          |
| `notary_is_signatory` | `bool`      |                                          |
| `tip_basis_points`    | `u32`       | Replaces `tip_percentage`; max 1,000,000 |

**IntentHeaderV2** (replaces TransactionHeaderV1 fields for per-intent config):

| Field                              | Type              | Note                         |
| ---------------------------------- | ----------------- | ---------------------------- |
| `network_id`                       | `u8`              |                              |
| `start_epoch_inclusive`            | `Epoch`           |                              |
| `end_epoch_exclusive`              | `Epoch`           |                              |
| `intent_discriminator`             | `u64`             | Replaces `nonce`; use random |
| `min_proposer_timestamp_inclusive` | `Option<Instant>` | Timestamp constraint         |
| `max_proposer_timestamp_exclusive` | `Option<Instant>` | Timestamp constraint         |

**IntentCoreV2** — shared structure for root intent and subintents:

```rust
pub struct IntentCoreV2 {
    pub header: IntentHeaderV2,
    pub blobs: BlobsV1,
    pub message: MessageV2,
    pub children: ChildSubintentSpecifiersV2,
    pub instructions: InstructionsV2,
}
```

**SubintentV2** — just wraps an `IntentCoreV2`.

### Partial Transactions (Subintent Composition)

```
SignedPartialTransactionV2
├── PartialTransactionV2
│   ├── root_subintent: SubintentV2
│   └── non_root_subintents: NonRootSubintentsV2  (flattened children)
├── root_subintent_signatures: IntentSignaturesV2
└── non_root_subintent_signatures: NonRootSubintentSignaturesV2
```

All descendant subintents from nested partial transactions are flattened into one list at the transaction level.

### Version-Agnostic Types

| Type                       | Purpose                                                           |
| -------------------------- | ----------------------------------------------------------------- |
| `UserTransaction`          | Enum: `V1(NotarizedTransactionV1)` / `V2(NotarizedTransactionV2)` |
| `AnyTransaction`           | Enum of all transaction types (user, system, ledger, flash)       |
| `TransactionDiscriminator` | Discriminator byte enum for payload type detection                |
| `ExecutableTransaction`    | Execution-ready representation                                    |
| `IntoExecutable`           | Trait for converting to executable form                           |

## Instructions

Each instruction implements the `ManifestInstruction` trait with `IDENT`, `ID`, `decompile()`, and `effect()`. `AnyInstruction` is a type alias for `InstructionV2`.

**V1 has 27 instructions. V2 has 35** (all V1 + 8 new).

### Bucket Lifecycle (V1 + V2)

| Instruction                   | RTM Name                          | ID     |
| ----------------------------- | --------------------------------- | ------ |
| `TakeFromWorktop`             | `TAKE_FROM_WORKTOP`               | `0x00` |
| `TakeNonFungiblesFromWorktop` | `TAKE_NON_FUNGIBLES_FROM_WORKTOP` | `0x01` |
| `TakeAllFromWorktop`          | `TAKE_ALL_FROM_WORKTOP`           | `0x02` |
| `ReturnToWorktop`             | `RETURN_TO_WORKTOP`               | `0x03` |
| `BurnResource`                | `BURN_RESOURCE`                   | `0x24` |

`TakeFromWorktop` fields: `resource_address: ResourceAddress`, `amount: Decimal`.
`TakeNonFungiblesFromWorktop` fields: `resource_address: ResourceAddress`, `ids: Vec<NonFungibleLocalId>`.
`TakeAllFromWorktop` fields: `resource_address: ResourceAddress`.
`ReturnToWorktop` / `BurnResource` fields: `bucket_id: ManifestBucket`.

### Resource Assertions

| Instruction                         | RTM Name                                | ID     | Version |
| ----------------------------------- | --------------------------------------- | ------ | ------- |
| `AssertWorktopContains`             | `ASSERT_WORKTOP_CONTAINS`               | `0x04` | V1+V2   |
| `AssertWorktopContainsNonFungibles` | `ASSERT_WORKTOP_CONTAINS_NON_FUNGIBLES` | `0x05` | V1+V2   |
| `AssertWorktopContainsAny`          | `ASSERT_WORKTOP_CONTAINS_ANY`           | `0x06` | V1+V2   |
| `AssertWorktopResourcesOnly`        | `ASSERT_WORKTOP_RESOURCES_ONLY`         | `0x08` | **V2**  |
| `AssertWorktopResourcesInclude`     | `ASSERT_WORKTOP_RESOURCES_INCLUDE`      | `0x09` | **V2**  |
| `AssertNextCallReturnsOnly`         | `ASSERT_NEXT_CALL_RETURNS_ONLY`         | `0x0A` | **V2**  |
| `AssertNextCallReturnsInclude`      | `ASSERT_NEXT_CALL_RETURNS_INCLUDE`      | `0x0B` | **V2**  |
| `AssertBucketContents`              | `ASSERT_BUCKET_CONTENTS`                | `0x0C` | **V2**  |

V2 assertions use `ManifestResourceConstraints` (map of `ResourceAddress` → `ManifestResourceConstraint`).

**ManifestResourceConstraint variants:** `NonZeroAmount`, `ExactAmount(Decimal)`, `AtLeastAmount(Decimal)`, `ExactNonFungibles(Vec<NonFungibleLocalId>)`, `AtLeastNonFungibles(Vec<NonFungibleLocalId>)`, `General(...)`.

### Proof Lifecycle (V1 + V2)

| Instruction                             | RTM Name                                       | ID     |
| --------------------------------------- | ---------------------------------------------- | ------ |
| `PopFromAuthZone`                       | `POP_FROM_AUTH_ZONE`                           | `0x10` |
| `PushToAuthZone`                        | `PUSH_TO_AUTH_ZONE`                            | `0x11` |
| `DropAuthZoneProofs`                    | `DROP_AUTH_ZONE_PROOFS`                        | `0x12` |
| `DropAuthZoneRegularProofs`             | `DROP_AUTH_ZONE_REGULAR_PROOFS`                | `0x13` |
| `CreateProofFromAuthZoneOfAmount`       | `CREATE_PROOF_FROM_AUTH_ZONE_OF_AMOUNT`        | `0x14` |
| `CreateProofFromAuthZoneOfNonFungibles` | `CREATE_PROOF_FROM_AUTH_ZONE_OF_NON_FUNGIBLES` | `0x15` |
| `CreateProofFromAuthZoneOfAll`          | `CREATE_PROOF_FROM_AUTH_ZONE_OF_ALL`           | `0x16` |
| `DropAuthZoneSignatureProofs`           | `DROP_AUTH_ZONE_SIGNATURE_PROOFS`              | `0x17` |
| `CreateProofFromBucketOfAmount`         | `CREATE_PROOF_FROM_BUCKET_OF_AMOUNT`           | `0x21` |
| `CreateProofFromBucketOfNonFungibles`   | `CREATE_PROOF_FROM_BUCKET_OF_NON_FUNGIBLES`    | `0x22` |
| `CreateProofFromBucketOfAll`            | `CREATE_PROOF_FROM_BUCKET_OF_ALL`              | `0x23` |
| `CloneProof`                            | `CLONE_PROOF`                                  | `0x30` |
| `DropProof`                             | `DROP_PROOF`                                   | `0x31` |
| `DropAllProofs`                         | `DROP_ALL_PROOFS`                              | `0x50` |
| `DropNamedProofs`                       | `DROP_NAMED_PROOFS`                            | `0x52` |

### Invocations (V1 + V2)

| Instruction                | RTM Name                      | ID     |
| -------------------------- | ----------------------------- | ------ |
| `CallFunction`             | `CALL_FUNCTION`               | `0x40` |
| `CallMethod`               | `CALL_METHOD`                 | `0x41` |
| `CallRoyaltyMethod`        | `CALL_ROYALTY_METHOD`         | `0x42` |
| `CallMetadataMethod`       | `CALL_METADATA_METHOD`        | `0x43` |
| `CallRoleAssignmentMethod` | `CALL_ROLE_ASSIGNMENT_METHOD` | `0x44` |
| `CallDirectVaultMethod`    | `CALL_DIRECT_VAULT_METHOD`    | `0x45` |

**CallFunction fields:** `package_address: ManifestPackageAddress`, `blueprint_name: String`, `function_name: String`, `args: ManifestValue`.

**CallMethod fields:** `address: ManifestGlobalAddress`, `method_name: String`, `args: ManifestValue`.

**Decompiled aliases** for well-known operations: `PUBLISH_PACKAGE`, `CREATE_ACCOUNT`, `CREATE_IDENTITY`, `CREATE_ACCESS_CONTROLLER`, `CREATE_FUNGIBLE_RESOURCE`, `CREATE_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY`, `CREATE_NON_FUNGIBLE_RESOURCE`, `MINT_FUNGIBLE`, `MINT_NON_FUNGIBLE`, `CREATE_VALIDATOR`, `SET_METADATA`, `SET_OWNER_ROLE`, `SET_ROLE`, `RECALL_FROM_VAULT`, `FREEZE_VAULT`, `UNFREEZE_VAULT`, etc.

### Address Allocation (V1 + V2)

| Instruction             | RTM Name                  | ID     |
| ----------------------- | ------------------------- | ------ |
| `AllocateGlobalAddress` | `ALLOCATE_GLOBAL_ADDRESS` | `0x51` |

Fields: `package_address: PackageAddress`, `blueprint_name: String`. Creates both an `AddressReservation` and a `NamedAddress`.

### Subintent Interaction (V2 only)

| Instruction     | RTM Name          | ID     | Fields                                                         |
| --------------- | ----------------- | ------ | -------------------------------------------------------------- |
| `YieldToChild`  | `YIELD_TO_CHILD`  | `0x61` | `child_index: ManifestNamedIntentIndex`, `args: ManifestValue` |
| `YieldToParent` | `YIELD_TO_PARENT` | `0x60` | `args: ManifestValue`                                          |
| `VerifyParent`  | `VERIFY_PARENT`   | `0x62` | `access_rule: AccessRule`                                      |

## ManifestBuilder API

`ManifestBuilder<M>` is generic over `M: BuildableManifest`.

### Type Aliases

| Alias                          | Manifest Type                            |
| ------------------------------ | ---------------------------------------- |
| `TransactionManifestV1Builder` | `ManifestBuilder<TransactionManifestV1>` |
| `TransactionManifestV2Builder` | `ManifestBuilder<TransactionManifestV2>` |
| `SubintentManifestV2Builder`   | `ManifestBuilder<SubintentManifestV2>`   |

### Constructors

| Method                                | Returns                       |
| ------------------------------------- | ----------------------------- |
| `ManifestBuilder::new()`              | V1 builder (backwards compat) |
| `ManifestBuilder::new_v1()`           | Explicit V1                   |
| `ManifestBuilder::new_v2()`           | V2 transaction manifest       |
| `ManifestBuilder::new_subintent_v2()` | V2 subintent manifest         |
| `ManifestBuilder::new_system_v1()`    | System transaction            |

### Manifest Types

| Type                          | Instruction Set | Has Children | is_subintent |
| ----------------------------- | --------------- | ------------ | ------------ |
| `TransactionManifestV1`       | `InstructionV1` | No           | false        |
| `TransactionManifestV2`       | `InstructionV2` | Yes          | false        |
| `SubintentManifestV2`         | `InstructionV2` | Yes          | true         |
| `SystemTransactionManifestV1` | `InstructionV1` | No           | false        |

### Bucket Operations (chainable, `self -> Self`)

```rust
.take_all_from_worktop(resource_address, "bucket_name")
.take_from_worktop(resource_address, amount, "bucket_name")
.take_non_fungibles_from_worktop(resource_address, ids, "bucket_name")
.return_to_worktop("bucket_name")
```

### Proof Operations

```rust
.pop_from_auth_zone("proof_name")
.push_to_auth_zone("proof_name")
.create_proof_from_auth_zone_of_amount(resource_address, amount, "proof_name")
.create_proof_from_auth_zone_of_non_fungibles(resource_address, ids, "proof_name")
.create_proof_from_auth_zone_of_all(resource_address, "proof_name")
.create_proof_from_bucket_of_amount("bucket", amount, "proof_name")
.create_proof_from_bucket_of_non_fungibles("bucket", ids, "proof_name")
.create_proof_from_bucket_of_all("bucket", "proof_name")
.clone_proof("proof", "new_proof")
.drop_proof("proof")
.drop_all_proofs()
.drop_named_proofs()
.drop_auth_zone_proofs()
.drop_auth_zone_signature_proofs()
.drop_auth_zone_regular_proofs()
```

### Invocations

```rust
.call_function(package_address, "Blueprint", "function", arguments)
.call_function_raw(package_address, "Blueprint", "function", raw_value)
.call_function_with_name_lookup(pkg, "Bp", "fn", |lookup| ...)
.call_method(address, "method", arguments)
.call_method_raw(address, "method", raw_value)
.call_method_with_name_lookup(address, "method", |lookup| ...)
.call_metadata_method(address, "method", arguments)
.call_royalty_method(address, "method", arguments)
.call_direct_access_method(address, "method", arguments)
.call_role_assignment_method(address, "method", arguments)
.call_module_method(address, module_id, "method", arguments)
```

### Account Operations

```rust
// Fee locking
.lock_fee(account_address, amount)
.lock_fee_from_faucet()
.lock_standard_test_fee(account)
.lock_contingent_fee(account, amount)

// Withdrawals
.withdraw_from_account(account, resource, amount)
.withdraw_non_fungibles_from_account(account, resource, ids)
.lock_fee_and_withdraw(account, fee, resource, amount)

// Deposits
.deposit(account, "bucket")
.deposit_entire_worktop(account)
.try_deposit_or_abort(account, badge, "bucket")
.try_deposit_entire_worktop_or_abort(account, badge)
.deposit_batch(account, buckets)

// Convenience
.new_account()
.get_free_xrd_from_faucet()
```

### Resource Operations

```rust
.create_fungible_resource(...)
.create_non_fungible_resource(...)
.mint_fungible(resource_address, amount)
.mint_non_fungible(...)
.burn_resource("bucket")
.burn_from_worktop(amount, resource_address)
.burn_all_from_worktop(resource_address)
```

### Address Allocation

```rust
.allocate_global_address(package_address, "Blueprint", "reservation_name", "address_name")
```

### V2-Only Assertions

```rust
.assert_worktop_resources_only(constraints)
.assert_worktop_resources_include(constraints)
.assert_worktop_is_empty()
.assert_next_call_returns_only(constraints)
.assert_next_call_returns_include(constraints)
.assert_bucket_contents("bucket", constraint)
```

### Subintent Interactions (V2 only)

```rust
.use_child("child_name", subintent_hash)
.yield_to_child("child_name", arguments)
.yield_to_child_with_name_lookup("child_name", |lookup| ...)
.yield_to_parent(arguments)
.yield_to_parent_with_name_lookup(|lookup| ...)
.verify_parent(access_rule)
```

### Utility Methods

```rust
.then(|builder| builder...)           // Arbitrary transform in chain
.with_name_lookup(|builder, lookup| ...)  // Get lookup in closure
.with_bucket("bucket", |builder, resolved| ...)  // Resolve bucket in closure
.bucket("name")                        // Lookup existing bucket
.proof("name")                         // Lookup existing proof
.named_address("name")                 // Lookup existing address
.generate_bucket_name("prefix")        // Collision-free name
.add_blob(content)                     // Returns ManifestBlobRef (&mut self!)
.build()                               // Validate and return manifest
.build_no_validate()                   // Skip validation
```

Note: `add_blob` takes `&mut self`, so use with `then()`:

```rust
.then(|mut builder| {
    let blob_ref = builder.add_blob(code_bytes);
    builder.call_function(pkg, "Bp", "fn", manifest_args!(blob_ref))
})
```

### Naming System

Builder uses named objects that map to sequential `u32` IDs in serialized form.

| Object              | Name Type                         | RTM Syntax                   |
| ------------------- | --------------------------------- | ---------------------------- |
| Bucket              | `NamedManifestBucket`             | `Bucket("name")`             |
| Proof               | `NamedManifestProof`              | `Proof("name")`              |
| Address Reservation | `NamedManifestAddressReservation` | `AddressReservation("name")` |
| Named Address       | `NamedManifestAddress`            | `NamedAddress("name")`       |
| Named Intent        | `NamedManifestIntent`             | `NamedIntent("name")`        |

Lifecycle: `Unregistered` → `Present(id)` → `Consumed`. Prevents reuse of consumed buckets/proofs.

Traits for builder parameters: `NewManifestBucket`, `ConsumedManifestBucket`, `ReferencedManifestBucket` (and equivalent for Proof, AddressReservation, Address, Intent).

## Transaction Builders

### TransactionV1Builder (alias: `TransactionBuilder`)

```rust
TransactionBuilder::new()
    .header(TransactionHeaderV1 { ... })
    .manifest(manifest)
    .message(MessageV1::Plaintext(PlaintextMessageV1::text("hi")))
    .sign(&signer_key)           // call multiple times for multi-sig
    .multi_sign(vec_of_signers)  // or batch sign
    .notarize(&notary_key)
    .build()                     // -> NotarizedTransactionV1
```

Methods: `header()`, `manifest()`, `message()`, `sign()`, `multi_sign()`, `signer_signatures()`, `notarize()`, `notary_signature()`, `build()`.

### TransactionV2Builder

For full V2 transactions with subintent trees:

```rust
TransactionV2Builder::new()
    .transaction_header(TransactionHeaderV2 { ... })
    .intent_header(IntentHeaderV2 { ... })
    .add_signed_child("child_name", signed_partial)  // 1. Add children FIRST
    .manifest_builder(|builder| { ... })              // 2. Build root manifest
    .sign(&signer_key)                                // 3. Sign
    .notarize(&notary_key)                            // 4. Notarize
    .build()                                          // -> DetailedNotarizedTransactionV2
```

Key pattern: children added via `add_signed_child` before `manifest_builder` — the builder auto-injects `use_child` for each.

Methods: `transaction_header()`, `intent_header()`, `message()`, `add_signed_child()`, `manifest_builder()`, `manifest_builder_with_lookup()`, `manifest()`, `sign()`, `multi_sign()`, `add_signature()`, `notarize()`, `notary_signature()`, `build()`, `build_no_validate()`, `build_minimal()`, `build_preview_transaction()`.

### PartialTransactionV2Builder

For building subintent subtrees (partial transactions):

```rust
PartialTransactionV2Builder::new()
    .intent_header(IntentHeaderV2 { ... })
    .add_signed_child("child_name", child_signed_partial)  // nested children
    .manifest_builder(|builder| { ... })
    .sign(&signer_key)
    .build()  // -> DetailedSignedPartialTransactionV2
```

Methods: `intent_header()`, `message()`, `add_signed_child()`, `manifest_builder()`, `manifest_builder_with_lookup()`, `manifest()`, `sign()`, `multi_sign()`, `add_signature()`, `build()`, `build_and_validate()`, `build_minimal()`.

## Signing Flow

### Key Types

```rust
pub enum PrivateKey {
    Secp256k1(Secp256k1PrivateKey),
    Ed25519(Ed25519PrivateKey),
}

pub trait Signer {
    fn public_key(&self) -> PublicKey;
    fn sign_without_public_key(&self, message_hash: &impl IsHash) -> SignatureV1;
    fn sign_with_public_key(&self, message_hash: &impl IsHash) -> SignatureWithPublicKeyV1;
}
```

Implemented for: `Secp256k1PrivateKey`, `Ed25519PrivateKey`, `PrivateKey`, `&S where S: Signer`.

### Signature Types

```rust
pub enum SignatureV1 {
    Secp256k1(Secp256k1Signature),
    Ed25519(Ed25519Signature),
}

pub enum SignatureWithPublicKeyV1 {
    Secp256k1 { signature: Secp256k1Signature },              // pubkey RECOVERED
    Ed25519 { public_key: Ed25519PublicKey, signature: Ed25519Signature },  // pubkey STORED
}

pub struct IntentSignatureV1(pub SignatureWithPublicKeyV1);
pub struct IntentSignaturesV1 { pub signatures: Vec<IntentSignatureV1> }
pub struct NotarySignatureV1(pub SignatureV1);  // bare sig; pubkey in header
```

**Secp256k1:** ECDSA with key recovery — public key recovered from signature during validation.
**Ed25519:** EdDSA — public key must be stored alongside signature (no recovery).

### V1 Signing Flow

```
1. Build IntentV1 (header + instructions + blobs + message)
2. Prepare → TransactionIntentHash
3. Each signer: sign_with_public_key(&intent_hash) → IntentSignatureV1
4. Build SignedIntentV1 (intent + all intent signatures)
5. Prepare → SignedTransactionIntentHash
6. Notary: sign(&signed_intent_hash) → NotarySignatureV1 (bare sig, pubkey in header)
7. Build NotarizedTransactionV1
```

### V2 Signing Flow

```
1. Each subintent signed independently by its signers (sign that subintent's hash)
2. Root transaction intent signed by its signers (sign transaction intent hash)
3. Signatures organized: transaction_intent_signatures + non_root_subintent_signatures
4. Notary signs signed_transaction_intent_hash
```

### Multi-Signature Limits

| Limit                                | Value                    |
| ------------------------------------ | ------------------------ |
| Max signer signatures per intent     | 16                       |
| Max total signature validations (V2) | 64                       |
| Duplicate signers                    | Error: `DuplicateSigner` |
| V1 notary duplicating signer         | Allowed (configurable)   |
| V2 notary duplicating signer         | **Forbidden**            |

Builder support: `sign(signer)` (one), `multi_sign(signers)` (batch), `signer_signatures(sigs)` (pre-computed).

## Validation Pipeline

### TransactionValidator

```rust
pub struct TransactionValidator {
    config: TransactionValidationConfig,
    required_network_id: Option<u8>,
}
```

Constructors:

- `new(database, network)` — reads config from substate database
- `new_with_latest_config(network)` — uses latest config
- `new_for_latest_simulator()` — latest config + simulator network
- `new_with_static_config(config, network_id)` — manual
- `new_with_latest_config_network_agnostic()` — no network check

### TransactionValidationConfig

Key limits (Cuttlefish values):

| Parameter                          | Value     |
| ---------------------------------- | --------- |
| `max_signer_signatures_per_intent` | 16        |
| `max_references_per_intent`        | 512       |
| `max_instructions`                 | 1000      |
| `max_epoch_range`                  | ~30 days  |
| `max_subintent_depth`              | 3         |
| `max_total_signature_validations`  | 64        |
| `max_total_references`             | 512       |
| `max_user_payload_length`          | 1 MB      |
| `max_child_subintents_per_intent`  | 32        |
| `max_subintents_per_transaction`   | 32        |
| `max_blobs`                        | 64        |
| `max_tip_basis_points`             | 1,000,000 |

### V1 Validation Steps

1. Construct `AllPendingSignatureValidations` (check signature counts)
2. **Validate intent:**
   - Header: network ID, epoch range (start < end, within max), tip percentage bounds
   - Message: plaintext length, MIME type length, encrypted message length, decryptor limits
   - Reference count
   - Instructions: `BabylonBasicValidator` or `StaticManifestInterpreter`
3. **Validate signatures** (deferred — most expensive step)

### V2 Validation Steps

1. Check `v2_transactions_allowed`
2. Construct pending signature validations from intent tree
3. **Validate intents and structure:**
   - Each intent: header, message, references, manifest via `StaticManifestInterpreter`
   - Intent header V2: network, epoch range, timestamp range, tip basis points
   - Tree structure:
     - All subintents unique
     - Each child has exactly one parent
     - Depth ≤ `max_subintent_depth`
     - All subintents reachable from root
     - `YIELD_TO_CHILD` / `YIELD_TO_PARENT` counts match per subintent
4. **Cross-intent aggregation** (`AcrossIntentAggregation`):
   - Total reference count check
   - Epoch range intersection (all intents must overlap)
   - Proposer timestamp range intersection
   - Empty intersection → `NoValidEpochRangeAcrossAllIntents`
5. **Validate all signatures**

### Error Hierarchy

```
TransactionValidationError
├── TransactionVersionNotPermitted
├── TransactionTooLarge
├── PrepareError
├── SubintentStructureError
│   ├── DuplicateSubintent
│   ├── SubintentHasMultipleParents
│   ├── ChildSubintentNotIncludedInTransaction
│   ├── SubintentExceedsMaxDepth
│   ├── SubintentIsNotReachableFromTheTransactionIntent
│   └── MismatchingYieldChildAndYieldParentCountsForSubintent
├── IntentValidationError
│   ├── ManifestBasicValidatorError
│   ├── ManifestValidationError
│   ├── InvalidMessage
│   ├── HeaderValidationError
│   └── TooManyReferences
└── SignatureValidationError
    └── DuplicateSigner
```

## Hashing Scheme

### Hash Construction (Concatenated Digest)

1. Start `HashAccumulator` seeded with `[TRANSACTION_HASHABLE_PAYLOAD_PREFIX, discriminator_byte]`
2. Recursively compute hash of each child field
3. Concatenate all child hashes (raw 32-byte arrays)
4. Hash concatenation → final hash

### V1 Hash Computations

```
IntentHash = hash(PREFIX || V1Intent_disc || hash(header_sbor) || hash(instructions_sbor) || hash(blobs) || hash(message_sbor))

SignedIntentHash = hash(PREFIX || V1SignedIntent_disc || intent_hash || hash(signatures_sbor))

NotarizedTxHash = hash(PREFIX || V1Notarized_disc || signed_intent_hash || hash(notary_sig_sbor))
```

### V2 Hash Computations

```
IntentCoreHash = hash(hash(header_body) || hash(blobs) || hash(message_body) || hash(children_hashes) || hash(instructions_body))

TransactionIntentHash = hash(PREFIX || TxIntent_disc || tx_header_hash || root_intent_core_hash || non_root_subintents_hash)

SubintentHash = hash(PREFIX || Subintent_disc || intent_core_hash)
```

**V2 difference:** uses `hash_encoded_sbor_value_body` (skips version byte AND value kind byte), vs V1 which uses `hash_encoded_sbor_value` (skips only version byte).

### Hash Types (Distinct Newtypes)

| Type                          | Purpose                                     | Bech32m Prefix  |
| ----------------------------- | ------------------------------------------- | --------------- |
| `TransactionIntentHash`       | Primary transaction ID                      | `txid_`         |
| `SignedTransactionIntentHash` | Signed intent ID                            | `signedintent_` |
| `NotarizedTransactionHash`    | Notarized payload ID                        | (varies)        |
| `SubintentHash`               | Subintent ID (committed only once)          | `subtxid_`      |
| `IntentHash`                  | Enum: `Transaction(...)` / `Subintent(...)` | —               |

### Signature Validation

`AllPendingSignatureValidations.validate_all()`:

1. Check total signature count ≤ `max_total_signature_validations`
2. Per intent:
   - TransactionIntent: verify intent sigs against intent hash + notary sig against signed intent hash
   - Subintent: verify intent sigs against subintent hash (no notary)
   - Preview: skip verification, just check duplicate public keys
3. Return `SignatureValidationSummary` with `root_signer_keys`, `non_root_signer_keys`, `total_signature_validations`

Key: `verify_and_recover(signed_hash, signature)` — Secp256k1 recovers public key; Ed25519 verifies provided key.

## SBOR Encoding

### Manifest SBOR

Transactions use **Manifest SBOR** (Radix-specific SBOR variant).

- Traits: `ManifestEncode` / `ManifestDecode` / `ManifestCategorize` (derive via `ManifestSbor`)
- Payload prefix: `MANIFEST_SBOR_V1_PAYLOAD_PREFIX`
- Max depth: `MANIFEST_SBOR_V1_MAX_DEPTH`

### Payload Discrimination

Each transaction type has a single-byte discriminator in `AnyTransaction`:

| Discriminator | Type                     |
| ------------- | ------------------------ |
| 1             | `TransactionIntentV1`    |
| 3             | `NotarizedTransactionV1` |
| 9             | `TransactionIntentV2`    |
| 12            | `NotarizedTransactionV2` |

Fields marked `#[sbor(flatten)]` are encoded inline as tuples.

### Raw Types

Each payload type has a `Raw*` wrapper (e.g., `RawNotarizedTransaction`) — `Vec<u8>` with `TransactionPayloadKind`. Conversions: `to_raw()` ↔ `from_raw()`.

### Preparation (Decode + Hash)

Per REP-82: **preparation = decoding + hash calculation**. Validation is separate.

The `prepare` method:

1. SBOR-encode to `Raw*` type
2. `TransactionDecoder` checks payload size limits
3. Recursively decode each field, computing hashes
4. Produce `Prepared*` type with `Summary`:

```rust
pub struct Summary {
    pub effective_length: usize,
    pub total_bytes_hashed: usize,
    pub hash: Hash,
}
```

## Preview Transactions

### V1 Preview

```rust
pub struct PreviewIntentV1 {
    pub intent: IntentV1,
    pub signer_public_keys: Vec<PublicKey>,  // No actual signatures
    pub flags: PreviewFlags,
}

pub struct PreviewFlags {
    pub use_free_credit: bool,              // 10,000 XRD free credit for fees
    pub assume_all_signature_proofs: bool,  // Simulates all signature resource proofs
    pub skip_epoch_check: bool,             // Uses simulated intent hash
    pub disable_auth: bool,
}
```

Preview skips actual signature verification — takes public keys directly. Intent still validated (header, message, instructions, manifest). With `skip_epoch_check`, uses `SimulatedTransactionIntentNullification`.

### V2 Preview

V2 preview includes `root_signer_public_keys` and `non_root_subintent_signer_public_keys` (one set per subintent).

`TransactionV2Builder.build_preview_transaction()` converts real signatures into public keys by recovering them from subintent hashes.

## Costing / Fees

```rust
pub struct TransactionCostingParameters {
    pub tip: TipSpecifier,
    pub free_credit_in_xrd: Decimal,  // Preview only
}

pub enum TipSpecifier {
    None,
    Percentage(u16),    // V1: 0–65535%
    BasisPoints(u32),   // V2: 0–1,000,000 basis points
}
```

`ExecutionContext` carries: `payload_size` (from `Summary.effective_length`), `num_of_signature_validations`, `costing_parameters`.

## Subintent Yield Protocol

```
1. Parent registers child:     USE_CHILD NamedIntent("name") Intent("subtxid_...")
2. Parent yields to child:     YIELD_TO_CHILD NamedIntent("name") <args>
3. Child processes, may:       VERIFY_PARENT <access_rule>
4. Child yields back:          YIELD_TO_PARENT <args>
5. Steps 2–4 can repeat (coroutine-like)
6. Final YIELD_TO_PARENT must be last instruction in child manifest
```

### Constraints

| Constraint                     | Limit                                                               |
| ------------------------------ | ------------------------------------------------------------------- |
| Max subintent depth            | 3 (+ root = 4 levels)                                               |
| Max subintents per transaction | 32                                                                  |
| Parent per subintent           | Exactly 1                                                           |
| Reachability                   | All subintents must be reachable from root                          |
| Yield count matching           | `YIELD_TO_CHILD` count in parent = `YIELD_TO_PARENT` count in child |
| Child manifest ending          | Must end with `YIELD_TO_PARENT`                                     |

## Blobs

```rust
pub struct BlobsV1 { pub blobs: Vec<BlobV1> }
pub struct BlobV1(pub Vec<u8>);
```

Builder: `add_blob(&mut self, content: Vec<u8>) -> ManifestBlobRef`. Max 64 blobs.

RTM syntax: `Blob("hex_hash")`.

## Messages

### V1

```rust
pub enum MessageV1 {
    None,
    Plaintext(PlaintextMessageV1),
    Encrypted(EncryptedMessageV1),
}
```

`PlaintextMessageV1::text("content")` convenience constructor.

### V2

```rust
pub enum MessageV2 {
    None,
    Plaintext(PlaintextMessageV1),  // Reuses V1 type
    Encrypted(EncryptedMessageV2),
}
```
