# Radix Transaction Manifest Reference

Technical reference for the transaction manifest system. Covers instruction sets (V1/V2), manifest structs, the ManifestBuilder, compiler pipeline, trait hierarchy, static validation, instruction effects, and manifest value types. Source: `radix-transactions/src/manifest/`, `radix-transactions/src/model/`, `radix-transactions/src/builder/`, `radix-common/src/data/manifest/model/`.

## Manifest Structs

### TransactionManifestV1

```rust
pub struct TransactionManifestV1 {
    pub instructions: Vec<InstructionV1>,
    pub blobs: IndexMap<Hash, Vec<u8>>,
    pub object_names: ManifestObjectNames,
}
```

- `is_subintent()` returns `false`
- No children support
- Built with `ManifestBuilder::new()` or `ManifestBuilder::new_v1()`

### TransactionManifestV2

```rust
pub struct TransactionManifestV2 {
    pub instructions: Vec<InstructionV2>,
    pub blobs: IndexMap<Hash, Vec<u8>>,
    pub children: IndexSet<ChildSubintentSpecifier>,
    pub object_names: ManifestObjectNames,
}
```

- `is_subintent()` returns `false`
- Supports children via `add_child_subintent(hash: SubintentHash)`
- Built with `ManifestBuilder::new_v2()`
- `for_intent()` returns `(InstructionsV2, BlobsV1, ChildSubintentSpecifiersV2)`
- `to_intent_core(header, message)` creates `IntentCoreV2`

### SubintentManifestV2

```rust
pub struct SubintentManifestV2 {
    pub instructions: Vec<InstructionV2>,
    pub blobs: IndexMap<Hash, Vec<u8>>,
    pub children: IndexSet<ChildSubintentSpecifier>,
    pub object_names: ManifestObjectNames,
}
```

- `is_subintent()` returns `true` (key difference from TransactionManifestV2)
- NOT executable by itself
- Must end with `YIELD_TO_PARENT`
- Built with `ManifestBuilder::new_subintent_v2()`

## Instruction Sets

### InstructionV1 (28 variants)

| Category | Instruction | Discriminator | Fields |
|----------|-------------|---------------|--------|
| **Bucket** | `TakeFromWorktop` | `0x00` | `resource_address`, `amount` |
| | `TakeNonFungiblesFromWorktop` | `0x01` | `resource_address`, `ids: Vec<NonFungibleLocalId>` |
| | `TakeAllFromWorktop` | `0x02` | `resource_address` |
| | `ReturnToWorktop` | `0x03` | `bucket_id: ManifestBucket` |
| | `BurnResource` | `0x24` | `bucket_id: ManifestBucket` |
| **Assert** | `AssertWorktopContainsAny` | `0x06` | `resource_address` |
| | `AssertWorktopContains` | `0x04` | `resource_address`, `amount` |
| | `AssertWorktopContainsNonFungibles` | `0x05` | `resource_address`, `ids` |
| **Proof** | `CreateProofFromBucketOfAmount` | `0x21` | `bucket_id`, `amount` |
| | `CreateProofFromBucketOfNonFungibles` | `0x22` | `bucket_id`, `ids` |
| | `CreateProofFromBucketOfAll` | `0x23` | `bucket_id` |
| | `CreateProofFromAuthZoneOfAmount` | `0x14` | `resource_address`, `amount` |
| | `CreateProofFromAuthZoneOfNonFungibles` | `0x15` | `resource_address`, `ids` |
| | `CreateProofFromAuthZoneOfAll` | `0x16` | `resource_address` |
| | `CloneProof` | `0x30` | `proof_id: ManifestProof` |
| | `DropProof` | `0x31` | `proof_id: ManifestProof` |
| | `PushToAuthZone` | `0x11` | `proof_id: ManifestProof` |
| | `PopFromAuthZone` | `0x10` | (none) |
| | `DropAuthZoneProofs` | `0x12` | (none) |
| | `DropAuthZoneRegularProofs` | `0x13` | (none) |
| | `DropAuthZoneSignatureProofs` | `0x17` | (none) |
| | `DropNamedProofs` | `0x52` | (none) |
| | `DropAllProofs` | `0x50` | (none) |
| **Invoke** | `CallFunction` | `0x40` | `package_address: ManifestPackageAddress`, `blueprint_name`, `function_name`, `args: ManifestValue` |
| | `CallMethod` | `0x41` | `address: ManifestGlobalAddress`, `method_name`, `args: ManifestValue` |
| | `CallRoyaltyMethod` | `0x42` | `address`, `method_name`, `args` |
| | `CallMetadataMethod` | `0x43` | `address`, `method_name`, `args` |
| | `CallRoleAssignmentMethod` | `0x44` | `address`, `method_name`, `args` |
| | `CallDirectVaultMethod` | `0x45` | `address: InternalAddress`, `method_name`, `args` |
| **Address** | `AllocateGlobalAddress` | `0x51` | `package_address: PackageAddress`, `blueprint_name` |

### InstructionV2 Additions (+8 = 36 total, but only 31 unique variants)

InstructionV2 includes all 28 V1 variants plus:

| Category | Instruction | Discriminator | Fields |
|----------|-------------|---------------|--------|
| **Assert (V2)** | `AssertWorktopResourcesOnly` | `0x08` | `constraints: ManifestResourceConstraints` |
| | `AssertWorktopResourcesInclude` | `0x09` | `constraints: ManifestResourceConstraints` |
| | `AssertNextCallReturnsOnly` | `0x0A` | `constraints: ManifestResourceConstraints` |
| | `AssertNextCallReturnsInclude` | `0x0B` | `constraints: ManifestResourceConstraints` |
| | `AssertBucketContents` | `0x0C` | `bucket_id: ManifestBucket`, `constraint: ManifestResourceConstraint` |
| **Intent** | `YieldToParent` | `0x60` | `args: ManifestValue` |
| | `YieldToChild` | `0x61` | `child_index: ManifestNamedIntentIndex`, `args: ManifestValue` |
| | `VerifyParent` | `0x62` | `access_rule: AccessRule` |

`AnyInstruction` is a type alias for `InstructionV2`.

### ManifestInstruction Trait

```rust
pub trait ManifestInstruction: Into<AnyInstruction> {
    const IDENT: &'static str;   // e.g. "TAKE_FROM_WORKTOP"
    const ID: u8;                // discriminator byte
    fn decompile(&self, context: &mut DecompilationContext) -> Result<DecompiledInstruction, DecompileError>;
    fn effect(&self) -> ManifestInstructionEffect<'_>;
}
```

## Decompilation Sugar

Certain `CallFunction`/`CallMethod` instructions decompile to named shortcuts based on known package/blueprint/function:

| Decompiled Name | Actual Instruction | Target |
|---|---|---|
| `PUBLISH_PACKAGE` | `CallFunction` | PACKAGE_PACKAGE / publish_wasm |
| `CREATE_ACCOUNT` | `CallFunction` | ACCOUNT_PACKAGE / create |
| `CREATE_ACCOUNT_ADVANCED` | `CallFunction` | ACCOUNT_PACKAGE / create_advanced |
| `CREATE_IDENTITY` | `CallFunction` | IDENTITY_PACKAGE / create |
| `CREATE_ACCESS_CONTROLLER` | `CallFunction` | ACCESS_CONTROLLER_PACKAGE / create |
| `CREATE_FUNGIBLE_RESOURCE` | `CallFunction` | RESOURCE_PACKAGE / create |
| `CREATE_NON_FUNGIBLE_RESOURCE` | `CallFunction` | RESOURCE_PACKAGE / create |
| `MINT_FUNGIBLE` | `CallMethod` | (resource manager) / mint |
| `CREATE_VALIDATOR` | `CallMethod` | (consensus manager) / create_validator |
| `SET_METADATA` | `CallMetadataMethod` | set |
| `SET_OWNER_ROLE` | `CallRoleAssignmentMethod` | set_owner_role |
| `SET_COMPONENT_ROYALTY` | `CallRoyaltyMethod` | set_royalty |
| `RECALL_FROM_VAULT` | `CallDirectVaultMethod` | recall |
| `ASSERT_WORKTOP_IS_EMPTY` | `AssertWorktopResourcesOnly` | (empty constraints) |

## Manifest String Syntax

The compiled manifest format uses a bash-like grammar. Each instruction = **command** + zero or more **arguments** (in manifest value syntax) + **semicolon**. Comments use `#`. All addresses use network-specific bech32m encoding (e.g. `resource_sim1...` for simulator, `resource_rdx1...` for mainnet).

### Bucket Lifecycle

```bash
# Take exact amount from worktop → named bucket
TAKE_FROM_WORKTOP
    Address("<resource_address>")
    Decimal("1.0")
    Bucket("xrd_bucket")
;

# Take specific NFTs from worktop → named bucket
TAKE_NON_FUNGIBLES_FROM_WORKTOP
    Address("<nft_resource_address>")
    Array<NonFungibleLocalId>(NonFungibleLocalId("#1#"), NonFungibleLocalId("#2#"))
    Bucket("nfts")
;

# Take all of a resource from worktop → named bucket
TAKE_ALL_FROM_WORKTOP
    Address("<resource_address>")
    Bucket("xrd_bucket")
;

# Return bucket contents to worktop
RETURN_TO_WORKTOP Bucket("xrd_bucket");

# Burn bucket contents (requires burn auth)
BURN_RESOURCE Bucket("xrd_bucket");
```

### Resource Assertions (V1)

```bash
# Worktop has any non-zero amount
ASSERT_WORKTOP_CONTAINS_ANY Address("<resource_address>");

# Worktop has at least this amount
ASSERT_WORKTOP_CONTAINS Address("<resource_address>") Decimal("1.0");

# Worktop has these specific NFTs
ASSERT_WORKTOP_CONTAINS_NON_FUNGIBLES
    Address("<nft_resource_address>")
    Array<NonFungibleLocalId>(NonFungibleLocalId("#1#"), NonFungibleLocalId("#2#"))
;
```

### Resource Assertions (V2 — Cuttlefish+)

```bash
# Worktop contains ONLY these resources (empty map = worktop is empty)
ASSERT_WORKTOP_RESOURCES_ONLY
    Map<Address, Enum>(
        Address("<resource_address>") => Enum<ResourceConstraint::NonZeroAmount>(),
    )
;

# Alias: worktop must be empty
ASSERT_WORKTOP_IS_EMPTY;

# Worktop includes at least these resources (others allowed)
ASSERT_WORKTOP_RESOURCES_INCLUDE
    Map<Address, Enum>(
        Address("<fungible_address>") => Enum<ResourceConstraint::ExactAmount>(Decimal("1")),
        Address("<nft_address>") => Enum<ResourceConstraint::AtLeastAmount>(Decimal("2")),
    )
;

# Next invocation must return ONLY these resources
ASSERT_NEXT_CALL_RETURNS_ONLY
    Map<Address, Enum>(
        Address("<nft_address>") => Enum<ResourceConstraint::ExactNonFungibles>(
            Array<NonFungibleLocalId>(NonFungibleLocalId("#234#"))
        ),
    )
;

# Assert bucket contents match constraint
ASSERT_BUCKET_CONTENTS
    Bucket("bucket")
    Enum<ResourceConstraint::General>(
        Tuple(
            Array<NonFungibleLocalId>(),     # required_ids
            Enum<LowerBound::NonZero>(),     # lower_bound
            Enum<UpperBound::Inclusive>(      # upper_bound
                Decimal("123")
            ),
            Enum<AllowedIds::Any>()          # allowed_ids
        )
    )
;
```

### Proof Lifecycle

```bash
# Proof from bucket (all contents)
CREATE_PROOF_FROM_BUCKET_OF_ALL Bucket("nfts") Proof("proof");

# Proof from bucket (specific amount)
CREATE_PROOF_FROM_BUCKET_OF_AMOUNT Bucket("xrd_bucket") Decimal("1.0") Proof("proof");

# Proof from auth zone (by amount)
CREATE_PROOF_FROM_AUTH_ZONE_OF_AMOUNT
    Address("<resource_address>") Decimal("1.0") Proof("proof");

# Proof from auth zone (all of resource)
CREATE_PROOF_FROM_AUTH_ZONE_OF_ALL Address("<resource_address>") Proof("proof");

# Pop most recent proof from auth zone
POP_FROM_AUTH_ZONE Proof("proof");

# Clone, drop, push
CLONE_PROOF Proof("proof") Proof("cloned_proof");
DROP_PROOF Proof("proof");
PUSH_TO_AUTH_ZONE Proof("proof");

# Bulk drops
DROP_NAMED_PROOFS;
DROP_ALL_PROOFS;
DROP_AUTH_ZONE_PROOFS;
DROP_AUTH_ZONE_SIGNATURE_PROOFS;
```

### Invocations

```bash
# Call a blueprint function
CALL_FUNCTION
    Address("<package_address>")
    "BlueprintName"
    "function_name"
    # ...args in manifest value syntax
;

# Call a method on a component
CALL_METHOD
    Address("<component_address>")
    "method_name"
    # ...args
;

# Module-specific methods
CALL_METADATA_METHOD Address("<entity>") "get" "key_name";
CALL_ROYALTY_METHOD Address("<component>") "set_royalty" "method" Enum<0u8>();
CALL_ROLE_ASSIGNMENT_METHOD Address("<component>") "get" Enum<0u8>() "role";

# Common aliases (decompile to CALL_FUNCTION / CALL_METHOD)
CREATE_ACCOUNT;
CREATE_ACCOUNT_ADVANCED
    Enum<OwnerRole::Updatable>(Enum<AccessRule::AllowAll>())
    None
;
SET_METADATA
    Address("<entity_address>")
    "name"
    Enum<Metadata::String>("My Entity Name")
;
SET_OWNER_ROLE
    Address("<entity_address>")
    Enum<AccessRule::Protected>(
        Enum<AccessRuleNode::ProofRule>(
            Enum<ProofRule::Require>(
                Enum<ResourceOrNonFungible::NonFungible>(
                    NonFungibleGlobalId("<resource_address>:#1#")
                )
            )
        )
    )
;
```

### Address Allocation

```bash
# Reserve an address for use later in the same transaction
ALLOCATE_GLOBAL_ADDRESS
    Address("<package_address>")
    "BlueprintName"
    AddressReservation("my_reservation")
    NamedAddress("my_address")
;

# Use the named address in subsequent calls
CALL_FUNCTION
    NamedAddress("my_address")
    "BlueprintName"
    "function_name"
;
```

### V2 Intent Interaction

```bash
# Declare a child subintent (must appear before other instructions)
USE_CHILD
    NamedIntent("child_one")
    Intent("subtxid_sim1...")
;

# Yield to a child (parent pauses, child runs until it yields back)
YIELD_TO_CHILD NamedIntent("child_one");
YIELD_TO_CHILD NamedIntent("child_one") Bucket("my_bucket");

# Yield to parent (subintent pauses/finishes; must end every subintent)
YIELD_TO_PARENT;
YIELD_TO_PARENT Bucket("my_bucket");
YIELD_TO_PARENT Expression("ENTIRE_WORKTOP");

# Restrict which parent can consume this subintent
VERIFY_PARENT
    Enum<AccessRule::Protected>(
        Enum<CompositeRequirement::BasicRequirement>(
            Enum<BasicRequirement::Require>(
                Enum<ResourceOrNonFungible::NonFungible>(
                    NonFungibleGlobalId("<ed25519_signature_badge>:<public_key_hash>")
                )
            )
        )
    )
;
```

### Full Transaction Example

A typical XRD transfer manifest (V1):

```bash
# 1. Lock fees from the sender account
CALL_METHOD
    Address("<sender_account>")
    "lock_fee"
    Decimal("10")
;

# 2. Withdraw XRD from sender
CALL_METHOD
    Address("<sender_account>")
    "withdraw"
    Address("<xrd_resource>")
    Decimal("100")
;

# 3. Take exact amount into a named bucket
TAKE_FROM_WORKTOP
    Address("<xrd_resource>")
    Decimal("100")
    Bucket("transfer")
;

# 4. Deposit into recipient account
CALL_METHOD
    Address("<recipient_account>")
    "try_deposit_or_abort"
    Bucket("transfer")
    None
;
```

## ManifestBuilder

### Structure & Constructors

```rust
pub struct ManifestBuilder<M: BuildableManifest = TransactionManifestV1> {
    registrar: ManifestNameRegistrar,
    manifest: M,
}

// Type aliases
pub type TransactionManifestV1Builder = ManifestBuilder<TransactionManifestV1>;
pub type TransactionManifestV2Builder = ManifestBuilder<TransactionManifestV2>;
pub type SubintentManifestV2Builder   = ManifestBuilder<SubintentManifestV2>;
```

| Constructor | Returns |
|---|---|
| `ManifestBuilder::new()` | V1 builder (default) |
| `ManifestBuilder::new_v1()` | V1 builder (explicit) |
| `ManifestBuilder::new_v2()` | V2 builder |
| `ManifestBuilder::new_subintent_v2()` | SubintentV2 builder |
| `ManifestBuilder::new_system_v1()` | SystemV1 builder |

### Name Resolution

| Method | Returns | Purpose |
|---|---|---|
| `bucket(name)` | `ManifestBucket` | Resolve named bucket |
| `proof(name)` | `ManifestProof` | Resolve named proof |
| `named_address(name)` | `ManifestNamedAddress` | Resolve named address |
| `address(name)` | `ManifestAddress::Named(...)` | Resolve as ManifestAddress |
| `address_reservation(name)` | `ManifestAddressReservation` | Resolve named reservation |
| `generate_bucket_name(prefix)` | `String` | Collision-free name |
| `generate_proof_name(prefix)` | `String` | Collision-free name |

### Usage Patterns

```rust
// Simple transfer
let manifest = ManifestBuilder::new()
    .lock_fee_from_faucet()
    .withdraw_from_account(from_account, XRD, dec!(1))
    .take_from_worktop(XRD, dec!(1), "xrd")
    .try_deposit_or_abort(to_account, None, "xrd")
    .build();

// With name lookup (for passing buckets to function args)
let manifest = ManifestBuilder::new()
    .lock_fee_from_faucet()
    .withdraw_from_account(from_account, XRD, dec!(1))
    .take_from_worktop(XRD, dec!(1), "xrd")
    .call_function_with_name_lookup(
        package_address,
        "SomeBlueprint",
        "some_function",
        |lookup| (lookup.bucket("xrd"),),
    )
    .build();
```

### NewSymbols (from add_instruction_advanced)

```rust
pub struct NewSymbols {
    pub new_bucket: Option<ManifestBucket>,
    pub new_proof: Option<ManifestProof>,
    pub new_address_reservation: Option<ManifestAddressReservation>,
    pub new_address_id: Option<ManifestNamedAddress>,
}
```

## Compiler Pipeline

Three-stage pipeline: **Lexer** -> **Parser** -> **Generator**

```rust
pub fn compile_manifest<M: BuildableManifest>(
    s: &str,
    network: &NetworkDefinition,
    blobs: impl IsBlobProvider,
) -> Result<M, CompileError> {
    let tokens = lexer::tokenize(s)?;
    let instructions = parser::Parser::new(tokens, PARSER_MAX_DEPTH)?.parse_manifest()?;
    generator::generate_manifest(&instructions, &addr_decoder, &tx_decoder, blobs)
}
```

### Entry Points

| Function | Purpose |
|---|---|
| `compile_manifest_v1(s, network, blobs)` | V1 shortcut |
| `compile_manifest::<M>(s, network, blobs)` | Generic (M: BuildableManifest) |
| `compile_any_manifest(s, kind, network, blobs)` | Dynamic dispatch via `ManifestKind` |
| `compile_manifest_with_pretty_error(...)` | With diagnostics |

### ManifestKind / AnyManifest

```rust
pub enum ManifestKind { V1, SystemV1, V2, SubintentV2 }

pub enum AnyManifest {
    V1(TransactionManifestV1),
    SystemV1(SystemTransactionManifestV1),
    V2(TransactionManifestV2),
    SubintentV2(SubintentManifestV2),
}
```

### CompileError

```rust
pub enum CompileError {
    LexerError(lexer::LexerError),
    ParserError(parser::ParserError),
    GeneratorError(generator::GeneratorError),
}
```

## Trait Hierarchy

```
ReadableManifestBase
  -> TypedReadableManifest
    -> ReadableManifest (auto-impl)
      -> BuildableManifest
        -> BuildableManifestSupportingChildren    (V2, SubintentV2)
        -> BuildableManifestSupportingPreallocatedAddresses (SystemV1)
        -> BuildableManifestWithParent            (SubintentV2 only)
```

### ReadableManifestBase

```rust
pub trait ReadableManifestBase {
    fn is_subintent(&self) -> bool;
    fn get_blobs(&self) -> impl Iterator<Item = (&Hash, &Vec<u8>)>;
    fn get_preallocated_addresses(&self) -> &[PreAllocatedAddress] { &[] }
    fn get_child_subintent_hashes(&self) -> impl ExactSizeIterator<Item = &ChildSubintentSpecifier>;
    fn get_known_object_names_ref(&self) -> ManifestObjectNamesRef<'_>;
}
```

### TypedReadableManifest

```rust
pub trait TypedReadableManifest: ReadableManifestBase {
    type Instruction: ManifestInstructionSet;
    fn get_typed_instructions(&self) -> &[Self::Instruction];
}
```

### ReadableManifest (auto-implemented)

```rust
pub trait ReadableManifest: ReadableManifestBase {
    fn iter_instruction_effects(&self) -> impl Iterator<Item = ManifestInstructionEffect<'_>>;
    fn iter_cloned_instructions(&self) -> impl Iterator<Item = AnyInstruction>;
    fn instruction_count(&self) -> usize;
    fn instruction_effect(&self, index: usize) -> ManifestInstructionEffect<'_>;
    fn validate(&self, ruleset: ValidationRuleset) -> Result<(), ManifestValidationError>;
}
```

### BuildableManifest

```rust
pub trait BuildableManifest:
    TypedReadableManifest + Into<AnyManifest> + ManifestEncode + Default + Eq + Debug
{
    fn builder() -> ManifestBuilder<Self>;
    fn add_instruction(&mut self, instruction: Self::Instruction);
    fn add_blob(&mut self, hash: Hash, content: Vec<u8>);
    fn set_names(&mut self, names: KnownManifestObjectNames);
    fn add_child_subintent(&mut self, hash: SubintentHash) -> Result<(), ManifestBuildError>;
    fn default_test_execution_config_type(&self) -> DefaultTestExecutionConfigType;
    fn into_executable_with_proofs(...) -> Result<ExecutableTransaction, String>;
    fn to_raw(self) -> Result<RawManifest, EncodeError>;
    fn from_raw(raw: &RawManifest) -> Result<Self, String>;
}
```

### ManifestInstructionSet

```rust
pub trait ManifestInstructionSet: TryFrom<AnyInstruction> + Into<AnyInstruction> + Clone {
    fn decompile(&self, context: &mut DecompilationContext) -> Result<DecompiledInstruction, DecompileError>;
    fn effect(&self) -> ManifestInstructionEffect<'_>;
    fn into_any(self) -> AnyInstruction;
    fn map_ref<M: InstructionRefMapper>(&self, mapper: M) -> M::Output<'_>;
    fn map_self<M: OwnedInstructionMapper>(self, mapper: M) -> M::Output;
}
```

### Mapper Pattern (double-dispatch)

```rust
pub trait InstructionRefMapper {
    type Output<'i>;
    fn apply<'i>(self, instruction: &'i impl ManifestInstruction) -> Self::Output<'i>;
}

pub trait OwnedInstructionMapper {
    type Output;
    fn apply(self, instruction: impl ManifestInstruction) -> Self::Output;
}
```

## Instruction Effect System

### ManifestInstructionEffect

```rust
pub enum ManifestInstructionEffect<'a> {
    CreateBucket { source_amount: BucketSourceAmount<'a> },
    CreateProof { source_amount: ProofSourceAmount<'a> },
    ConsumeBucket { consumed_bucket: ManifestBucket, destination: BucketDestination<'a> },
    ConsumeProof { consumed_proof: ManifestProof, destination: ProofDestination<'a> },
    CloneProof { cloned_proof: ManifestProof },
    DropManyProofs { drop_all_named_proofs: bool, drop_all_authzone_signature_proofs: bool, drop_all_authzone_non_signature_proofs: bool },
    Invocation { kind: InvocationKind<'a>, args: &'a ManifestValue },
    CreateAddressAndReservation { package_address: &'a PackageAddress, blueprint_name: &'a str },
    ResourceAssertion { assertion: ResourceAssertion<'a> },
    Verification { verification: VerificationKind, access_rule: &'a AccessRule },
}
```

### InvocationKind

```rust
pub enum InvocationKind<'a> {
    Method { address: &'a ManifestGlobalAddress, module_id: ModuleId, method: &'a str },
    Function { address: &'a ManifestPackageAddress, blueprint: &'a str, function: &'a str },
    DirectMethod { address: &'a InternalAddress, method: &'a str },
    YieldToParent,
    YieldToChild { child_index: ManifestNamedIntent },
}
```

### Source & Destination Types

```rust
pub enum BucketSourceAmount<'a> {
    AllOnWorktop { resource_address: &'a ResourceAddress },
    AmountFromWorktop { resource_address: &'a ResourceAddress, amount: Decimal },
    NonFungiblesFromWorktop { resource_address: &'a ResourceAddress, ids: &'a [NonFungibleLocalId] },
}

pub enum ProofSourceAmount<'a> {
    AuthZonePopLastAddedProof,
    AuthZoneAllOf { resource_address: &'a ResourceAddress },
    AuthZoneAmount { resource_address: &'a ResourceAddress, amount: Decimal },
    AuthZoneNonFungibles { resource_address: &'a ResourceAddress, ids: &'a [NonFungibleLocalId] },
    BucketAllOf { bucket: ManifestBucket },
    BucketAmount { bucket: ManifestBucket, amount: Decimal },
    BucketNonFungibles { bucket: ManifestBucket, ids: &'a [NonFungibleLocalId] },
}

pub enum BucketDestination<'a> { Worktop, Burned, Invocation(InvocationKind<'a>) }
pub enum ProofDestination<'a> { AuthZone, Drop, Invocation(InvocationKind<'a>) }
```

### Resource Assertions

```rust
pub enum ResourceAssertion<'a> {
    Worktop(WorktopAssertion<'a>),
    NextCall(NextCallAssertion<'a>),
    Bucket(BucketAssertion<'a>),
}

pub enum WorktopAssertion<'a> {
    ResourceNonZeroAmount { resource_address: &'a ResourceAddress },
    ResourceAtLeastAmount { resource_address: &'a ResourceAddress, amount: Decimal },
    ResourceAtLeastNonFungibles { resource_address: &'a ResourceAddress, ids: &'a [NonFungibleLocalId] },
    ResourcesOnly { constraints: &'a ManifestResourceConstraints },
    ResourcesInclude { constraints: &'a ManifestResourceConstraints },
}

pub enum NextCallAssertion<'a> {
    ReturnsOnly { constraints: &'a ManifestResourceConstraints },
    ReturnsInclude { constraints: &'a ManifestResourceConstraints },
}

pub enum BucketAssertion<'a> {
    Contents { bucket: ManifestBucket, constraint: &'a ManifestResourceConstraint },
}
```

## Static Manifest Interpreter

### Interpreter Structure

```rust
pub struct StaticManifestInterpreter<'a, M: ReadableManifest + ?Sized> {
    validation_ruleset: ValidationRuleset,
    manifest: &'a M,
    location: ManifestLocation,
    registered_blobs: IndexSet<ManifestBlobRef>,
    bucket_state: Vec<BucketState<'a>>,
    proof_state: Vec<ProofState<'a>>,
    address_reservation_state: Vec<AddressReservationState<'a>>,
    named_address_state: Vec<NamedAddressState<'a>>,
    intent_state: Vec<IntentState<'a>>,
    next_instruction_requirement: NextInstructionRequirement,
}
```

### Interpretation Pipeline

1. `handle_preallocated_addresses` -- register pre-allocated address reservations
2. `handle_child_subintents` -- register child intent state
3. `handle_blobs` -- register blobs, check for duplicates
4. For each instruction: `handle_instruction` -- dispatch on effect type
5. `handle_wrap_up` -- check for dangling buckets/reservations

### State Tracking

```rust
pub struct BucketState<'a> {
    pub name: Option<&'a str>,
    pub source_amount: BucketSourceAmount<'a>,
    pub created_at: ManifestLocation,
    pub proof_locks: u32,          // can't consume while locked
    pub consumed_at: Option<ManifestLocation>,
}

pub struct ProofState<'a> {
    pub name: Option<&'a str>,
    pub source_amount: ProofSourceAmount<'a>,
    pub created_at: ManifestLocation,
    pub consumed_at: Option<ManifestLocation>,
}

pub enum ManifestLocation { Preamble, Instruction { index: usize } }
```

### ValidationRuleset

```rust
pub struct ValidationRuleset {
    pub validate_no_duplicate_blobs: bool,
    pub validate_blob_refs: bool,
    pub validate_bucket_proof_lock: bool,
    pub validate_no_dangling_nodes: bool,
    pub validate_dynamic_address_in_command_part: bool,
    pub validate_resource_assertions: bool,
}
```

Presets: `ValidationRuleset::all()`, `ValidationRuleset::babylon_equivalent()`, `ValidationRuleset::cuttlefish()`

### Key Validation Rules

- Subintents must end with `YIELD_TO_PARENT`
- `YieldToParent` only allowed in subintents
- `YieldToChild` must reference a registered child intent
- Proofs cannot be passed to another intent (YieldToParent/YieldToChild)
- `ASSERT_NEXT_CALL_RETURNS_*` must be immediately followed by an invocation
- Buckets cannot be consumed while locked by a proof (`proof_locks > 0`)
- No dangling buckets or address reservations at manifest end

### Visitor Pattern

```rust
pub trait ManifestInterpretationVisitor {
    fn on_start_instruction(&mut self, ...) -> ControlFlow<ManifestValidationError>;
    fn on_end_instruction(&mut self, ...) -> ControlFlow<ManifestValidationError>;
    fn on_new_bucket(&mut self, ...) -> ControlFlow<ManifestValidationError>;
    fn on_consume_bucket(&mut self, ...) -> ControlFlow<ManifestValidationError>;
    fn on_new_proof(&mut self, ...) -> ControlFlow<ManifestValidationError>;
    fn on_consume_proof(&mut self, ...) -> ControlFlow<ManifestValidationError>;
    fn on_new_address_reservation(&mut self, ...) -> ControlFlow<ManifestValidationError>;
    fn on_consume_address_reservation(&mut self, ...) -> ControlFlow<ManifestValidationError>;
    fn on_new_named_address(&mut self, ...) -> ControlFlow<ManifestValidationError>;
    fn on_new_intent(&mut self, ...) -> ControlFlow<ManifestValidationError>;
    fn on_drop_authzone_proofs(&mut self, ...) -> ControlFlow<ManifestValidationError>;
    fn on_resource_assertion(&mut self, ...) -> ControlFlow<ManifestValidationError>;
    fn on_verification(&mut self, ...) -> ControlFlow<ManifestValidationError>;
    fn on_finish(&mut self, ...) -> ControlFlow<ManifestValidationError>;
}
```

### ManifestValidationError

```rust
pub enum ManifestValidationError {
    DuplicateBlob(ManifestBlobRef),
    BlobNotRegistered(ManifestBlobRef),
    BucketNotYetCreated(ManifestBucket),
    BucketAlreadyUsed(ManifestBucket, String),
    BucketConsumedWhilstLockedByProof(ManifestBucket, String),
    ProofNotYetCreated(ManifestProof),
    ProofAlreadyUsed(ManifestProof, String),
    AddressReservationNotYetCreated(ManifestAddressReservation),
    AddressReservationAlreadyUsed(ManifestAddressReservation, String),
    NamedAddressNotYetCreated(ManifestNamedAddress),
    ChildIntentNotRegistered(ManifestNamedIntent),
    DanglingBucket(ManifestBucket, String),
    DanglingAddressReservation(ManifestAddressReservation, String),
    ArgsEncodeError(EncodeError),
    ArgsDecodeError(DecodeError),
    InstructionNotSupportedInTransactionIntent,
    SubintentDoesNotEndWithYieldToParent,
    ProofCannotBePassedToAnotherIntent,
    TooManyInstructions,
    InvalidResourceConstraint,
    InstructionFollowingNextCallAssertionWasNotInvocation,
    ManifestEndedWhilstExpectingNextCallAssertion,
}
```

## Manifest Value Types

All defined in `radix-common/src/data/manifest/model/`.

### Core ID Types

| Type | Inner | Encoding | CustomValueKind |
|---|---|---|---|
| `ManifestBucket` | `u32` | 4 bytes LE | `Bucket` |
| `ManifestProof` | `u32` | 4 bytes LE | `Proof` |
| `ManifestAddressReservation` | `u32` | 4 bytes LE | `AddressReservation` |
| `ManifestNamedAddress` | `u32` | 4 bytes LE | (part of ManifestAddress) |
| `ManifestNamedIntentIndex` | `u32` | 4 bytes LE | (used in YieldToChild) |

### ManifestAddress

```rust
pub enum ManifestAddress {
    Static(NodeId),              // discriminator 0x00, then 30 bytes NodeId
    Named(ManifestNamedAddress), // discriminator 0x01, then 4 bytes u32
}
```

### ManifestExpression

```rust
pub enum ManifestExpression {
    EntireWorktop,    // byte: 0
    EntireAuthZone,   // byte: 1
}
```

### Batch Types

```rust
pub enum ManifestBucketBatch {
    ManifestBuckets(Vec<ManifestBucket>),
    EntireWorktop,
}

pub enum ManifestProofBatch {
    ManifestProofs(Vec<ManifestProof>),
    EntireAuthZone,
}
```

### Additional Value Types

| File | Type | Purpose |
|---|---|---|
| `manifest_blob.rs` | `ManifestBlobRef` | Reference to blob by hash |
| `manifest_decimal.rs` | `ManifestDecimal` | Decimal in manifest encoding |
| `manifest_non_fungible_local_id.rs` | NFT local ID in manifest encoding |
| `manifest_precise_decimal.rs` | `ManifestPreciseDecimal` | High-precision decimal |
| `manifest_resource_assertion.rs` | `ManifestResourceConstraint`, `ManifestResourceConstraints` | V2 assertion data |
| `manifest_address_kinds.rs` | `ManifestGlobalAddress`, `ManifestPackageAddress`, etc. | Typed address wrappers |

## Architectural Notes

- **V1 vs V2**: V1 has 28 instructions, V2 adds 5 assertion types + 3 intent interaction types (31 total)
- **Subintent vs Transaction**: `is_subintent()` controls whether `YieldToParent`/`VerifyParent` are allowed
- **Builder is panic-based**: Designed for test code; panics on invariant violations rather than returning errors
- **SBOR encoding**: Uses `ManifestSbor` derive with `#[sbor(discriminator(...))]` and `#[sbor(flatten)]`
- **Wire-format stability**: InstructionV2 uses `#[sbor_assert(backwards_compatible(...))]` with snapshot files
- **ManifestNamedIntentIndex**: `YieldToChild` uses `ManifestNamedIntentIndex(u32)` wrapper (ideally `ManifestNamedIntent` but SBOR versioning prevented this)
- **EphemeralManifest**: Temporary struct for in-place validation without allocating a full manifest
