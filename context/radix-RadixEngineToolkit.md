# Radix Engine Toolkit Reference

Technical reference for the `radix-engine-toolkit` Rust crate (v2.3.4). Offline utility library for transaction analysis, address derivation, SBOR encoding/decoding, and transaction serialization. Does **not** build transactions — see `radix-transactions` for that.

**Source:** `.repos/radix-engine-toolkit/crates/radix-engine-toolkit/`
**License:** Apache 2.0
**Key dependencies:** `radixdlt-scrypto` family (`sbor`, `scrypto`, `radix-common`, `radix-engine`, `radix-engine-interface`, `radix-transactions`), `bech32`, `sbor-json`

---

## Crate Structure

All source paths relative to `crates/radix-engine-toolkit/src/`.

| Module              | Purpose                                                              |
| ------------------- | -------------------------------------------------------------------- |
| `functions/`        | Public API — derive, address, SBOR, transaction V1/V2, events, info |
| `types/`            | Core types — entity types, instructions, worktop, hashing, IO       |
| `extensions/`       | Extension traits on external types (BlueprintId, NetworkDefinition)  |
| `manifest_analysis/`| Static & dynamic manifest analysis, classification engine           |
| `constants/`        | Constants and configuration values                                   |

**Crate types:** `staticlib`, `cdylib`, `rlib` — usable from Rust, C/FFI, and WASM.

---

## Address Derivation (`functions::derive`)

All 12 public functions for deriving Radix addresses from keys, Olympia addresses, or other inputs.

### Babylon Address Derivation

| Function | Input | Output |
| -------- | ----- | ------ |
| `preallocated_account_address_from_public_key<P>` | `&P` where `P: Into<PublicKey> + Clone` | `ComponentAddress` |
| `preallocated_identity_address_from_public_key<P>` | `&P` where `P: Into<PublicKey> + Clone` | `ComponentAddress` |
| `preallocated_signature_non_fungible_global_id_from_public_key<P>` | `&P` where `P: HasPublicKeyHash` | `NonFungibleGlobalId` |
| `public_key_hash_from_public_key<P>` | `&P` where `P: HasPublicKeyHash` | `P::TypedPublicKeyHash` |

### Caller Badge Derivation

| Function | Input | Output |
| -------- | ----- | ------ |
| `global_caller_non_fungible_global_id_from_global_address` | `GlobalAddress` | `NonFungibleGlobalId` |
| `global_caller_non_fungible_global_id_from_blueprint_id` | `BlueprintId` | `NonFungibleGlobalId` |
| `package_of_direct_caller_non_fungible_global_id_from_package_address` | `PackageAddress` | `NonFungibleGlobalId` |

### Olympia ↔ Babylon Bridge

| Function | Input | Output |
| -------- | ----- | ------ |
| `preallocated_account_address_from_olympia_account_address<S>` | `S: AsRef<str>` | `Result<ComponentAddress, DerivationError>` |
| `resource_address_from_olympia_resource_address<S>` | `S: AsRef<str>` | `Result<ResourceAddress, DerivationError>` |
| `public_key_from_olympia_account_address<S>` | `S: AsRef<str>` | `Result<Secp256k1PublicKey, DerivationError>` |
| `olympia_account_address_from_public_key` | `&Secp256k1PublicKey`, `OlympiaNetwork` | `String` |

### Node Address

| Function | Input | Output |
| -------- | ----- | ------ |
| `node_address_from_public_key` | `&Secp256k1PublicKey`, `network_id: u8` | `String` |

### DerivationError

```rust
pub enum DerivationError {
    InvalidCharsInOlympiaAddressEntitySpecifier {
        expected: (char, char),
        actual: (char, char),
    },
    InvalidOlympiaAddressLength { expected: usize, actual: usize },
    InvalidOlympiaBech32Variant {
        expected: bech32::Variant,
        actual: bech32::Variant,
    },
    InvalidOlympiaAddressPrefix { expected: u8, actual: u8 },
    Bech32DecodeError(bech32::Error),
    Bech32BaseConversionError(bech32::Error),
}
```

Only returned by the Olympia bridge functions. Babylon derivation functions are infallible.

---

## Transaction Processing — V1

Module: `functions::transaction_v1`. Five submodules mirroring the V1 transaction tree.

### Instructions (`transaction_v1::instructions`)

```rust
pub fn statically_validate(
    instructions: &[InstructionV1],
    blobs: &IndexMap<Hash, Vec<u8>>,
    network_definition: &NetworkDefinition,
) -> Result<(), InstructionValidationError>

pub fn extract_addresses(
    instructions: &[InstructionV1],
) -> (HashSet<NodeId>, HashSet<ManifestNamedAddress>)
```

### Intent (`transaction_v1::intent`)

| Function | Signature |
| -------- | --------- |
| `hash` | `(&IntentV1) -> Result<TransactionHash, PrepareError>` |
| `to_payload_bytes` | `(&IntentV1) -> Result<Vec<u8>, EncodeError>` |
| `from_payload_bytes` | `(T: AsRef<[u8]>) -> Result<IntentV1, DecodeError>` |
| `statically_validate` | `(&IntentV1, &NetworkDefinition) -> Result<(), TransactionValidationError>` |

### Manifest (`transaction_v1::manifest`)

| Function | Signature |
| -------- | --------- |
| `to_payload_bytes` | `(&TransactionManifestV1) -> Result<Vec<u8>, EncodeError>` |
| `from_payload_bytes` | `(T: AsRef<[u8]>) -> Result<TransactionManifestV1, String>` |
| `statically_validate` | `(&TransactionManifestV1, &NetworkDefinition) -> Result<(), TransactionValidationError>` |
| `statically_analyze` | `(&TransactionManifestV1) -> Result<StaticAnalysis, ManifestAnalysisError>` |
| `dynamically_analyze` | `(&TransactionManifestV1, RuntimeToolkitTransactionReceipt) -> Result<DynamicAnalysis, ManifestAnalysisError>` |

### SignedIntent (`transaction_v1::signed_intent`)

| Function | Signature |
| -------- | --------- |
| `hash` | `(&SignedIntentV1) -> Result<TransactionHash, PrepareError>` |
| `to_payload_bytes` | `(&SignedIntentV1) -> Result<Vec<u8>, EncodeError>` |
| `from_payload_bytes` | `(T: AsRef<[u8]>) -> Result<SignedIntentV1, DecodeError>` |
| `statically_validate` | `(&SignedIntentV1, &NetworkDefinition) -> Result<(), TransactionValidationError>` |

### NotarizedTransaction (`transaction_v1::notarized_transaction`)

| Function | Signature |
| -------- | --------- |
| `hash` | `(&NotarizedTransactionV1) -> Result<TransactionHash, PrepareError>` |
| `to_payload_bytes` | `(&NotarizedTransactionV1) -> Result<Vec<u8>, EncodeError>` |
| `from_payload_bytes` | `(T: AsRef<[u8]>) -> Result<NotarizedTransactionV1, DecodeError>` |
| `statically_validate` | `(&NotarizedTransactionV1, &NetworkDefinition) -> Result<(), TransactionValidationError>` |
| `extract_signer_public_keys` | `(&NotarizedTransactionV1) -> Result<IndexSet<PublicKey>, TransactionValidationError>` |

---

## Transaction Processing — V2

Module: `functions::transaction_v2`. Seven submodules reflecting the V2 tree (with subintents).

### Key Differences from V1

- **Subintent support:** `SubintentV2`, `PartialTransactionV2`, `SignedPartialTransactionV2` have no V1 equivalent
- **Manifest types:** `TransactionManifestV2` and `SubintentManifestV2` replace `TransactionManifestV1`
- **Validation:** V2 manifests use `ManifestValidationError` (not `TransactionValidationError`)
- **Tree structure:** `TransactionIntentV2` → `SignedTransactionIntentV2` replaces the flat V1 layers
- **Analysis:** Both `TransactionManifestV2` and `SubintentManifestV2` support `statically_analyze`

### Instructions (`transaction_v2::instructions`)

```rust
pub fn extract_addresses(
    instructions: &[InstructionV2],
) -> (HashSet<NodeId>, HashSet<ManifestNamedAddress>)
```

No `statically_validate` — validation is done at the manifest level in V2.

### TransactionManifest (`transaction_v2::transaction_manifest`)

| Function | Signature |
| -------- | --------- |
| `to_payload_bytes` | `(&TransactionManifestV2) -> Result<Vec<u8>, EncodeError>` |
| `from_payload_bytes` | `(T: AsRef<[u8]>) -> Result<TransactionManifestV2, String>` |
| `statically_validate` | `(&TransactionManifestV2) -> Result<(), ManifestValidationError>` |
| `statically_analyze` | `(&TransactionManifestV2) -> Result<StaticAnalysis, ManifestAnalysisError>` |
| `dynamically_analyze` | `(&TransactionManifestV2, RuntimeToolkitTransactionReceipt) -> Result<DynamicAnalysis, ManifestAnalysisError>` |

### SubintentManifest (`transaction_v2::subintent_manifest`)

| Function | Signature |
| -------- | --------- |
| `to_payload_bytes` | `(&SubintentManifestV2) -> Result<Vec<u8>, EncodeError>` |
| `from_payload_bytes` | `(T: AsRef<[u8]>) -> Result<SubintentManifestV2, String>` |
| `statically_validate` | `(&SubintentManifestV2) -> Result<(), ManifestValidationError>` |
| `statically_analyze` | `(&SubintentManifestV2) -> Result<StaticAnalysis, ManifestAnalysisError>` |
| `as_enclosed` | `(&SubintentManifestV2) -> Option<TransactionManifestV2>` |

`as_enclosed` converts a subintent manifest into a full transaction manifest if it is self-contained (no external references).

### TransactionIntent

| Function | Signature |
| -------- | --------- |
| `hash` | `(&TransactionIntentV2) -> Result<TransactionHash, PrepareError>` |
| `to_payload_bytes` | `(&TransactionIntentV2) -> Result<Vec<u8>, EncodeError>` |
| `from_payload_bytes` | `(T: AsRef<[u8]>) -> Result<TransactionIntentV2, DecodeError>` |

### SignedTransactionIntent

| Function | Signature |
| -------- | --------- |
| `hash` | `(&SignedTransactionIntentV2) -> Result<TransactionHash, PrepareError>` |
| `to_payload_bytes` | `(&SignedTransactionIntentV2) -> Result<Vec<u8>, EncodeError>` |
| `from_payload_bytes` | `(T: AsRef<[u8]>) -> Result<SignedTransactionIntentV2, DecodeError>` |

### NotarizedTransaction

| Function | Signature |
| -------- | --------- |
| `hash` | `(&NotarizedTransactionV2) -> Result<TransactionHash, PrepareError>` |
| `to_payload_bytes` | `(&NotarizedTransactionV2) -> Result<Vec<u8>, EncodeError>` |
| `from_payload_bytes` | `(T: AsRef<[u8]>) -> Result<NotarizedTransactionV2, DecodeError>` |
| `statically_validate` | `(&NotarizedTransactionV2, &NetworkDefinition) -> Result<(), TransactionValidationError>` |
| `extract_signer_public_keys` | `(&NotarizedTransactionV2) -> Result<IndexSet<PublicKey>, TransactionValidationError>` |

### Subintent

| Function | Signature |
| -------- | --------- |
| `hash` | `(&SubintentV2) -> Result<TransactionHash, PrepareError>` |
| `to_payload_bytes` | `(&SubintentV2) -> Result<Vec<u8>, EncodeError>` |
| `from_payload_bytes` | `(T: AsRef<[u8]>) -> Result<SubintentV2, DecodeError>` |

### PartialTransaction

| Function | Signature |
| -------- | --------- |
| `hash` | `(&PartialTransactionV2) -> Result<TransactionHash, PrepareError>` |
| `to_payload_bytes` | `(&PartialTransactionV2) -> Result<Vec<u8>, EncodeError>` |
| `from_payload_bytes` | `(T: AsRef<[u8]>) -> Result<PartialTransactionV2, DecodeError>` |

### SignedPartialTransaction

| Function | Signature |
| -------- | --------- |
| `hash` | `(&SignedPartialTransactionV2) -> Result<TransactionHash, PrepareError>` |
| `to_payload_bytes` | `(&SignedPartialTransactionV2) -> Result<Vec<u8>, EncodeError>` |
| `from_payload_bytes` | `(T: AsRef<[u8]>) -> Result<SignedPartialTransactionV2, DecodeError>` |
| `statically_validate` | `(&SignedPartialTransactionV2, &NetworkDefinition) -> Result<(), TransactionValidationError>` |

---

## Manifest Analysis

The classification engine determines what a transaction manifest *does* without executing it.

### Two Analysis Modes

| Mode | Input | Output | When to use |
| ---- | ----- | ------ | ----------- |
| **Static** | Manifest only | `StaticAnalysis` | Pre-submission — no receipt available |
| **Dynamic** | Manifest + receipt | `DynamicAnalysis` | Post-execution — receipt provides runtime data |

Both work on any `ReadableManifest` (V1 manifest, V2 manifest, V2 subintent manifest).

```rust
// Core analysis functions (in manifest_analysis::analysis)
pub fn statically_analyze(manifest: &impl ReadableManifest)
    -> Result<StaticAnalysis, ManifestAnalysisError>

pub fn dynamically_analyze(
    manifest: &impl ReadableManifest,
    receipt: RuntimeToolkitTransactionReceipt,
) -> Result<DynamicAnalysis, ManifestAnalysisError>
```

### StaticAnalysis

```rust
pub struct StaticAnalysis {
    pub account_interactions_summary: AccountInteractionsOutput,
    pub account_static_resource_movements_summary: AccountStaticResourceMovementsOutput,
    pub proofs_created_summary: PresentedProofsOutput,
    pub entities_encountered_summary: EncounteredEntitiesOutput,
    pub entities_requiring_auth_summary: EntitiesRequiringAuthOutput,
    pub reserved_instructions_summary: ReservedInstructionsOutput,
    pub manifest_classification: Vec<ManifestClassification>,
}
```

| Field | Type | What it tells you |
| ----- | ---- | ----------------- |
| `account_interactions_summary` | `AccountInteractionsOutput` | Which accounts are withdrawn from / deposited to |
| `account_static_resource_movements_summary` | `AccountStaticResourceMovementsOutput` | Statically-determinable resource movements per account |
| `proofs_created_summary` | `PresentedProofsOutput` | Proofs created during the manifest |
| `entities_encountered_summary` | `EncounteredEntitiesOutput` | All entities (components, resources, packages) referenced |
| `entities_requiring_auth_summary` | `EntitiesRequiringAuthOutput` | Entities that need auth signatures |
| `reserved_instructions_summary` | `ReservedInstructionsOutput` | Lock fee, assert worktop instructions |
| `manifest_classification` | `Vec<ManifestClassification>` | What the manifest *does* (see below) |

### DynamicAnalysis

Extends `StaticAnalysis` with runtime data:

```rust
pub struct DynamicAnalysis {
    // Same as StaticAnalysis:
    pub account_interactions_summary: AccountInteractionsOutput,
    pub account_static_resource_movements_summary: AccountStaticResourceMovementsOutput,
    pub proofs_created_summary: PresentedProofsOutput,
    pub entities_encountered_summary: EncounteredEntitiesOutput,
    pub entities_requiring_auth_summary: EntitiesRequiringAuthOutput,
    pub reserved_instructions_summary: ReservedInstructionsOutput,
    // Dynamic-only:
    pub account_dynamic_resource_movements_summary: AccountDynamicResourceMovementsOutput,
    pub entities_newly_created_summary: NewEntitiesOutput,
    pub fee_locks_summary: FeeLocks,
    pub fee_consumption_summary: FeeSummary,
    pub detailed_manifest_classification: Vec<DetailedManifestClassification>,
}
```

| Extra field | Type | What it tells you |
| ----------- | ---- | ----------------- |
| `account_dynamic_resource_movements_summary` | `AccountDynamicResourceMovementsOutput` | Actual resource movements from receipt |
| `entities_newly_created_summary` | `NewEntitiesOutput` | Entities created by this transaction |
| `fee_locks_summary` | `FeeLocks` | Fee lock amounts |
| `fee_consumption_summary` | `FeeSummary` | Fee breakdown (execution, royalty, storage) |
| `detailed_manifest_classification` | `Vec<DetailedManifestClassification>` | Classifications with detailed outputs |

### ManifestClassification (9 Variants)

Used by static analysis. Classifies what a manifest does.

```rust
pub enum ManifestClassification {
    General,
    GeneralSubintent,
    Transfer,
    ValidatorStake,
    ValidatorUnstake,
    ValidatorClaimXrd,
    PoolContribution,
    PoolRedemption,
    AccountDepositSettingsUpdate,
}
```

| Variant | Meaning |
| ------- | ------- |
| `General` | Arbitrary invocations — doesn't fit specific categories |
| `GeneralSubintent` | Arbitrary subintent invocations |
| `Transfer` | Account-to-account resource transfers only |
| `ValidatorStake` | Staking XRD to validators |
| `ValidatorUnstake` | Unstaking LSUs from validators |
| `ValidatorClaimXrd` | Claiming XRD from completed unstaking |
| `PoolContribution` | Contributing resources to a pool |
| `PoolRedemption` | Redeeming pool units for underlying resources |
| `AccountDepositSettingsUpdate` | Modifying account deposit rules |

### DetailedManifestClassification

Used by dynamic analysis. Same variants but with detailed output data:

```rust
pub enum DetailedManifestClassification {
    General,
    GeneralSubintent,
    Transfer { is_one_to_one_transfer: bool },
    ValidatorStake(ValidatorStakingOutput),
    ValidatorUnstake(ValidatorUnstakingOutput),
    ValidatorClaimXrd(ValidatorClaimingXrdOutput),
    PoolContribution(PoolContributionOutput),
    PoolRedemption(PoolRedemptionOutput),
    AccountDepositSettingsUpdate(AccountSettingsUpdateOutput),
}
```

`Transfer` gains `is_one_to_one_transfer: bool`. All staking/pool variants carry typed outputs with amounts, addresses, and receipt data.

---

## SBOR Functions

Two parallel modules for the two SBOR flavors used in Radix.

### Manifest SBOR (`functions::manifest_sbor`)

For encoding/decoding values in transaction manifests.

```rust
pub fn encode(value: &ManifestValue) -> Result<Vec<u8>, EncodeError>

pub fn decode<T: AsRef<[u8]>>(value: T) -> Result<ManifestValue, DecodeError>

pub fn decode_to_string_representation<T: AsRef<[u8]>>(
    value: T,
    representation: ManifestSborStringRepresentation,
    bech32_encoder: &AddressBech32Encoder,
    schema: Option<(LocalTypeId, Schema<ScryptoCustomSchema>)>,
) -> Result<String, ManifestSborError>
```

```rust
pub enum ManifestSborError {
    SchemaValidationError,
    DecodeError(DecodeError),
    FmtError(std::fmt::Error),
}
```

### Scrypto SBOR (`functions::scrypto_sbor`)

For encoding/decoding values stored on ledger (component state, vault contents, events).

```rust
pub fn encode(value: &ScryptoValue) -> Result<Vec<u8>, EncodeError>

pub fn decode<T: AsRef<[u8]>>(value: T) -> Result<ScryptoValue, DecodeError>

pub fn decode_to_string_representation<T: AsRef<[u8]>>(
    value: T,
    representation: SerializationMode,
    bech32_encoder: &AddressBech32Encoder,
    schema: Option<(LocalTypeId, Schema<ScryptoCustomSchema>)>,
) -> Result<String, ScryptoSborError>

pub fn encode_string_representation(
    representation: ScryptoSborStringRepresentation,
) -> Result<Vec<u8>, ScryptoSborError>
```

```rust
pub enum ScryptoSborError {
    SchemaValidationError,
    DecodeError(DecodeError),
    EncodeError(EncodeError),
    SerdeDeserializationFailed(serde_json::Error),
    ValueContainsNetworkMismatch,
}
```

Key difference: Scrypto SBOR has `encode_string_representation` for converting JSON/string representations back to bytes. Manifest SBOR does not.

---

## Utility Functions

### Access Rule Entity Extraction (`functions::access_rule`)

```rust
pub fn extract_entities(access_rule: &AccessRule) -> IndexSet<ResourceOrNonFungible>
```

Walks an `AccessRule` tree and collects all referenced resources and non-fungible IDs.

### Event Decoding (`functions::events`)

```rust
pub fn scrypto_sbor_decode_to_native_event(
    event_type_identifier: &EventTypeIdentifier,
    event_data: &[u8],
) -> Result<TypedNativeEvent, TypedNativeEventError>
```

Decodes raw event bytes into typed native event variants. Works for all native blueprint events (Account, Validator, Pool, etc.).

### Address Decoding (`functions::address`)

```rust
pub fn entity_type(node_id: TypedNodeId) -> EntityType

pub fn decode(node_id: &str) -> Option<(u8, EntityType, String, [u8; 30])>
```

`decode` parses a bech32m address string → `(network_id, entity_type, hrp, body_bytes)`. Returns `None` for invalid addresses.

### Transaction ID Decoding (`functions::utils`)

```rust
pub fn decode_transaction_id(
    transaction_id: &str,
    network_definition: &NetworkDefinition,
) -> Result<Hash, TransactionHashBech32DecodeError>
```

Decodes a bech32m-encoded transaction ID (like `txid_rdx1...`) back to its raw hash.

### Build Information (`functions::information`)

```rust
pub fn information() -> BuildInformation

pub struct BuildInformation {
    pub version: String,
    pub scrypto_dependency: DependencyInformation,
}

pub enum DependencyInformation {
    Version(String),   // From crates.io
    Tag(String),       // From GitHub tag
    Branch(String),    // From GitHub branch
    Rev(String),       // From GitHub commit
}
```

---

## Core Types

### TransactionHash

```rust
pub struct TransactionHash {
    pub hash: Hash,
    pub id: String,   // bech32m-encoded (e.g. "txid_rdx1...")
}

impl TransactionHash {
    pub fn new<H>(transaction_hash: H, network_id: u8) -> Self
    where H: IsTransactionHash + IsHash
}
```

### InstructionIndex

```rust
#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Sbor, Default)]
pub struct InstructionIndex(usize);

impl InstructionIndex {
    pub const fn of(index: usize) -> Self
    pub const fn value(&self) -> &usize
    pub const fn add(&self, instructions: usize) -> Option<Self>  // overflow-safe
}
```

Newtype wrapper ensuring instruction indices are not confused with other `usize` values.

### TypedNodeId

```rust
pub struct TypedNodeId(EntityType, NodeId);

impl TypedNodeId {
    pub fn new<T: Into<NodeId>>(node_id: T) -> Result<Self, InvalidEntityTypeIdError>
    pub fn entity_type(&self) -> EntityType
    pub fn as_node_id(&self) -> &NodeId
    pub fn to_vec(&self) -> Vec<u8>
    pub fn as_bytes(&self) -> &[u8]
}
```

A `NodeId` paired with its validated `EntityType`. Construction validates the first byte.

### GroupedEntityType

Groups all Radix entity types into logical categories:

```rust
pub enum GroupedEntityType {
    AccountEntities(AccountEntities),
    IdentityEntities(IdentityEntities),
    PoolEntities(PoolEntities),
    InternalEntities(InternalEntities),
    SystemEntities(SystemEntities),
    ResourceManagerEntities(ResourceManagerEntities),
    AccessControllerEntities(AccessControllerEntities),
    GenericComponentEntities(GenericComponentEntities),
    AccountLockerEntities(AccountLockerEntities),
    PackageEntities(PackageEntities),
    ValidatorEntities(ValidatorEntities),
}
```

**Entity group → variants:**

| Group | Variants |
| ----- | -------- |
| `AccountEntities` | `GlobalAccount`, `GlobalPreallocatedSecp256k1Account`, `GlobalPreallocatedEd25519Account` |
| `IdentityEntities` | `GlobalIdentity`, `GlobalPreallocatedSecp256k1Identity`, `GlobalPreallocatedEd25519Identity` |
| `PoolEntities` | `GlobalOneResourcePool`, `GlobalTwoResourcePool`, `GlobalMultiResourcePool` |
| `InternalEntities` | `InternalGenericComponent`, `InternalFungibleVault`, `InternalNonFungibleVault`, `InternalKeyValueStore` |
| `SystemEntities` | `GlobalConsensusManager`, `GlobalTransactionTracker` |
| `ResourceManagerEntities` | `GlobalFungibleResourceManager`, `GlobalNonFungibleResourceManager` |
| `AccessControllerEntities` | `GlobalAccessController` |
| `GenericComponentEntities` | `GlobalGenericComponent` |
| `AccountLockerEntities` | `GlobalAccountLocker` |
| `PackageEntities` | `GlobalPackage` |
| `ValidatorEntities` | `GlobalValidator` |

### GroupedInstruction

Categorizes manifest instructions by purpose:

```rust
pub enum GroupedInstruction {
    TakeFromWorktopInstructions(TakeFromWorktopInstructions),
    ReturnToWorktopInstructions(ReturnToWorktopInstructions),
    AssertionInstructions(AssertionInstructions),
    ProofInstructions(ProofInstructions),
    InvocationInstructions(InvocationInstructions),
    SubintentInstructions(SubintentInstructions),
    AddressAllocationInstructions(AddressAllocationInstructions),
    BurnResourceInstructions(BurnResourceInstructions),
}
```

### WorktopChanges

Tracks resource movements through the worktop per instruction:

```rust
pub struct WorktopChanges(IndexMap<InstructionIndex, Vec<WorktopChange>>);

impl WorktopChanges {
    pub fn new() -> Self
    pub fn first_take_of_resource(
        &self, instruction_index: &InstructionIndex, resource_address: ResourceAddress,
    ) -> Option<&ResourceSpecifier>
    pub fn first_put_of_resource(
        &self, instruction_index: &InstructionIndex, resource_address: ResourceAddress,
    ) -> Option<&ResourceSpecifier>
    pub fn first_take(&self, instruction_index: &InstructionIndex) -> Option<&ResourceSpecifier>
    pub fn first_put(&self, instruction_index: &InstructionIndex) -> Option<&ResourceSpecifier>
    pub fn take_iterator(
        &self, instruction_index: &InstructionIndex,
    ) -> impl Iterator<Item = &ResourceSpecifier>
    pub fn put_iterator(
        &self, instruction_index: &InstructionIndex,
    ) -> impl Iterator<Item = &ResourceSpecifier>
}
```

### InvocationIo

Tracks inputs and outputs of method/function invocations:

```rust
pub struct InvocationIo<T> {
    pub input: T,
    pub output: T,
}

pub struct InvocationIoItems(Vec<InvocationIoItem>);

pub struct IndexedInvocationIo(
    IndexMap<InstructionIndex, InvocationIo<InvocationIoItems>>
);
```

### OlympiaNetwork

Network identifiers for the legacy Olympia network:

```rust
pub enum OlympiaNetwork {
    Mainnet,       // HRP: "rdx"
    Stokenet,      // HRP: "tdx"
    Releasenet,    // HRP: "tdx3"
    RCNet,         // HRP: "tdx4"
    Milestonenet,  // HRP: "tdx5"
    Devopsnet,     // HRP: "tdx6"
    Sandpitnet,    // HRP: "tdx7"
    Localnet,      // HRP: "ddx"
}
```

---

## Extensions

### BlueprintId Entity Type Mapping

Extension trait on `BlueprintId` mapping blueprint package + name → `EntityType`:

```rust
impl BlueprintId {
    pub fn entity_type(&self) -> Option<EntityType>
}
```

Covers all native Babylon blueprints: Account, AccessController, ConsensusManager, Validator, Identity, AccountLocker, Package, Pools (1/2/multi-resource), FungibleResourceManager, NonFungibleResourceManager, TransactionProcessor, TransactionTracker.

Returns `None` for custom (non-native) blueprints.

### NetworkDefinition Helpers

Extension methods on `NetworkDefinition`:

```rust
impl NetworkDefinition {
    /// Look up by numeric network ID
    pub fn from_network_id(network_id: u8) -> Self

    /// Look up by human-readable part (e.g. "rdx", "tdx_2_")
    pub fn from_hrp(hrp: impl AsRef<str>) -> Option<Self>

    /// Extract network from a bech32m address string
    pub fn from_address_string(address: impl AsRef<str>) -> Option<Self>
}
```

**Known network IDs:**

| ID | Network |
| -- | ------- |
| `0x01` | Mainnet |
| `0x02` | Stokenet |
| `0x0A`–`0x0E` | Babylon temporary testnets |
| `0x20`–`0x25` | RDX Works development networks |
| `0xF0`–`0xF2` | Ephemeral networks (simulator, testing) |

---

## Usage Patterns

### Static Analysis Flow

```rust
use radix_engine_toolkit::functions::transaction_v1::manifest;

// 1. Decode manifest from bytes
let manifest = manifest::from_payload_bytes(&payload)?;

// 2. Run static analysis
let analysis = manifest::statically_analyze(&manifest)?;

// 3. Check classification
for class in &analysis.manifest_classification {
    match class {
        ManifestClassification::Transfer => { /* simple transfer */ },
        ManifestClassification::ValidatorStake => { /* staking */ },
        ManifestClassification::General => { /* complex/arbitrary */ },
        _ => {}
    }
}

// 4. Query account interactions
let interactions = &analysis.account_interactions_summary;
// → which accounts are deposited to, withdrawn from
```

### Classification Checking

```rust
let analysis = manifest::statically_analyze(&manifest)?;

let is_simple_transfer = analysis.manifest_classification
    .contains(&ManifestClassification::Transfer);

let is_staking = analysis.manifest_classification
    .contains(&ManifestClassification::ValidatorStake);
```

### Account Interaction Queries

```rust
// From static analysis:
let interactions = &analysis.account_interactions_summary;
// Provides: accounts withdrawn from, deposited to, with resource details

// From dynamic analysis (post-execution):
let dynamic = manifest::dynamically_analyze(&manifest, receipt)?;
let movements = &dynamic.account_dynamic_resource_movements_summary;
// Provides: actual resource amounts moved (from receipt)
```

### Address Derivation

```rust
use radix_engine_toolkit::functions::derive;

// Babylon account from public key
let account_address = derive::preallocated_account_address_from_public_key(&pub_key);

// Olympia → Babylon migration
let babylon_addr = derive::preallocated_account_address_from_olympia_account_address(
    "rdx1qsp..."
)?;

// Extract public key from Olympia address
let pub_key = derive::public_key_from_olympia_account_address("rdx1qsp...")?;
```

### SBOR Decode to String

```rust
use radix_engine_toolkit::functions::scrypto_sbor;

let string_repr = scrypto_sbor::decode_to_string_representation(
    &raw_bytes,
    SerializationMode::Programmatic,
    &bech32_encoder,
    Some((type_id, schema)),
)?;
```
