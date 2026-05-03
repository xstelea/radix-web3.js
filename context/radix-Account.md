# Radix Account Blueprint Reference

Technical reference for the Account native blueprint. Covers state structure, all 30 methods (27 original + 3 Cuttlefish), deposit validation, access control, creation flows, owner badge system, and events. Source: `radix-engine/src/blueprints/account/`, `radix-engine-interface/src/blueprints/account/`.

## Well-Known Addresses

```
ACCOUNT_PACKAGE:     package_rdx1pkgxxxxxxxxxaccntxxxxxxxxxx000929625493xxxxxxxxxaccntx
ACCOUNT_OWNER_BADGE: resource_rdx1nfxxxxxxxxxxaccwnrxxxxxxxxx006664022062xxxxxxxxxaccwnr
ACCOUNT_BLUEPRINT:   "Account"
```

Entity types for address derivation:

| Entity Type | Byte | Description |
|---|---|---|
| `GlobalAccount` | `0xC1` (193) | Standard account (securified or create_advanced) |
| `GlobalPreallocatedSecp256k1Account` | `0xD1` (209) | Virtual account from secp256k1 key |
| `GlobalPreallocatedEd25519Account` | `0x51` (81) | Virtual account from ed25519 key |

Preallocated address derivation: `ComponentAddress::preallocated_account_from_public_key(pk)` — hashes the public key bytes and prefixes with the entity type byte.

## State Structure

Declared via `declare_native_blueprint_state!` macro in `blueprint.rs:63`.

### Field

| Field | Type | Kind | Condition |
|---|---|---|---|
| `deposit_rule` | `AccountDepositRuleV1` (= `AccountSubstate`) | `StaticSingleVersioned` | Always |

```rust
pub struct AccountSubstate {
    pub default_deposit_rule: DefaultDepositRule,
}
```

### Key-Value Collections

| Collection | Key Type | Value Type | Ownership | Purpose |
|---|---|---|---|---|
| `resource_vaults` | `ResourceAddress` | `Vault` | `true` | Per-resource vaults, created on-demand |
| `resource_preferences` | `ResourceAddress` | `ResourcePreference` | `false` | Per-resource deposit allow/deny |
| `authorized_depositors` | `ResourceOrNonFungible` | `()` | `false` | Badges authorized to bypass deposit rules |

### Core Enums

```rust
pub enum DefaultDepositRule {
    Accept,       // Allow all; deny list honored
    Reject,       // Reject all; allow list honored
    AllowExisting, // Only existing resources or XRD; both lists honored
}

pub enum ResourcePreference {
    Allowed,      // On the allow list
    Disallowed,   // On the deny list
}
```

## Access Control

### Auth Config

```
FunctionAuth: AllowAll (create, create_advanced are public functions)

Roles:
  SECURIFY_ROLE ("securify") — updater: SELF_ROLE
  OWNER_ROLE ("_owner_")     — standard owner role

Methods:
  SECURIFY_ROLE:  securify
  OWNER_ROLE:     lock_fee, lock_contingent_fee,
                  deposit, deposit_batch,
                  withdraw, withdraw_non_fungibles,
                  lock_fee_and_withdraw, lock_fee_and_withdraw_non_fungibles,
                  create_proof_of_amount, create_proof_of_non_fungibles,
                  set_default_deposit_rule, set_resource_preference, remove_resource_preference,
                  burn, burn_non_fungibles,
                  add_authorized_depositor, remove_authorized_depositor
  Public:         try_deposit_or_refund, try_deposit_batch_or_refund,
                  try_deposit_or_abort, try_deposit_batch_or_abort,
                  balance, non_fungible_local_ids, has_non_fungible
```

### SecurifiedRoleAssignment

Account implements both `SecurifiedRoleAssignment` and `PresecurifiedRoleAssignment`:

```rust
struct SecurifiedAccount;
impl SecurifiedRoleAssignment for SecurifiedAccount {
    type OwnerBadgeNonFungibleData = AccountOwnerBadgeData;
    const OWNER_BADGE: ResourceAddress = ACCOUNT_OWNER_BADGE;
    const SECURIFY_ROLE: Option<&'static str> = Some("securify");
}
impl PresecurifiedRoleAssignment for SecurifiedAccount {}
```

## Methods Reference

All methods use `ReceiverInfo::normal_ref_mut()` unless noted. Query methods (Cuttlefish) use `ReceiverInfo::normal_ref()`.

### Creation (Functions — no receiver)

| Ident | Input | Output | Auth |
|---|---|---|---|
| `create` | `{}` | `(Global<AccountMarker>, Bucket)` | AllowAll |
| `create_advanced` | `{ owner_role: OwnerRole, address_reservation: Option<GlobalAddressReservation> }` | `Global<AccountMarker>` | AllowAll |

### Securification

| Ident | Input | Output | Auth |
|---|---|---|---|
| `securify` | `{}` | `Bucket` | SECURIFY_ROLE |

Converts a presecurified (virtual) account into a securified one. Mints an `AccountOwnerBadgeData` NFT and returns the badge bucket. The SECURIFY_ROLE updater is SELF_ROLE, meaning only the component itself can update it (and it does so during securification to disable re-securification).

### Fee Management

| Ident | Input | Output | Auth |
|---|---|---|---|
| `lock_fee` | `{ amount: Decimal }` | `()` | OWNER |
| `lock_contingent_fee` | `{ amount: Decimal }` | `()` | OWNER |

### Authenticated Deposit (owner-only)

| Ident | Input | Output | Auth |
|---|---|---|---|
| `deposit` | `{ bucket: Bucket }` | `()` | OWNER |
| `deposit_batch` | `{ buckets: Vec<Bucket> }` | `()` | OWNER |

No deposit validation — if auth passes, the deposit succeeds unconditionally. Vaults are created on-demand. Emits `DepositEvent`.

### Public Deposit (anyone can call)

| Ident | Input | Output | Auth |
|---|---|---|---|
| `try_deposit_or_refund` | `{ bucket: Bucket, authorized_depositor_badge: Option<ResourceOrNonFungible> }` | `Option<Bucket>` | Public |
| `try_deposit_batch_or_refund` | `{ buckets: Vec<Bucket>, authorized_depositor_badge: Option<ResourceOrNonFungible> }` | `Option<Vec<Bucket>>` | Public |
| `try_deposit_or_abort` | `{ bucket: Bucket, authorized_depositor_badge: Option<ResourceOrNonFungible> }` | `()` | Public |
| `try_deposit_batch_or_abort` | `{ buckets: Vec<Bucket>, authorized_depositor_badge: Option<ResourceOrNonFungible> }` | `()` | Public |

Refund variants: return rejected buckets as `Some(bucket)`, `None` if all deposited.
Abort variants: panic if any deposit is rejected.

### Withdrawal

| Ident | Input | Output | Auth |
|---|---|---|---|
| `withdraw` | `{ resource_address: ResourceAddress, amount: Decimal }` | `Bucket` | OWNER |
| `withdraw_non_fungibles` | `{ resource_address: ResourceAddress, ids: IndexSet<NonFungibleLocalId> }` | `Bucket` | OWNER |
| `lock_fee_and_withdraw` | `{ amount_to_lock: Decimal, resource_address: ResourceAddress, amount: Decimal }` | `Bucket` | OWNER |
| `lock_fee_and_withdraw_non_fungibles` | `{ amount_to_lock: Decimal, resource_address: ResourceAddress, ids: IndexSet<NonFungibleLocalId> }` | `Bucket` | OWNER |

Emits `WithdrawEvent`. Panics with `AccountError::VaultDoesNotExist` if no vault for the resource.

### Proof Creation

| Ident | Input | Output | Auth |
|---|---|---|---|
| `create_proof_of_amount` | `{ resource_address: ResourceAddress, amount: Decimal }` | `Proof` | OWNER |
| `create_proof_of_non_fungibles` | `{ resource_address: ResourceAddress, ids: IndexSet<NonFungibleLocalId> }` | `Proof` | OWNER |

### Deposit Rule Management

| Ident | Input | Output | Auth |
|---|---|---|---|
| `set_default_deposit_rule` | `{ default: DefaultDepositRule }` | `()` | OWNER |
| `set_resource_preference` | `{ resource_address: ResourceAddress, resource_preference: ResourcePreference }` | `()` | OWNER |
| `remove_resource_preference` | `{ resource_address: ResourceAddress }` | `()` | OWNER |
| `add_authorized_depositor` | `{ badge: ResourceOrNonFungible }` | `()` | OWNER |
| `remove_authorized_depositor` | `{ badge: ResourceOrNonFungible }` | `()` | OWNER |

### Burn

| Ident | Input | Output | Auth |
|---|---|---|---|
| `burn` | `{ resource_address: ResourceAddress, amount: Decimal }` | `()` | OWNER |
| `burn_non_fungibles` | `{ resource_address: ResourceAddress, ids: IndexSet<NonFungibleLocalId> }` | `()` | OWNER |

### Query (Cuttlefish extension — read-only)

| Ident | Input | Output | Auth |
|---|---|---|---|
| `balance` | `{ resource_address: ResourceAddress }` | `Decimal` | Public |
| `non_fungible_local_ids` | `{ resource_address: ResourceAddress, limit: u32 }` | `IndexSet<NonFungibleLocalId>` | Public |
| `has_non_fungible` | `{ resource_address: ResourceAddress, local_id: NonFungibleLocalId }` | `bool` | Public |

## Deposit Validation Logic

Three-tier decision in `is_deposit_allowed(resource_address)`:

```
1. Check resource_preferences KV store:
   - Allowed  → return true
   - Disallowed → return false
2. Fall through to default_deposit_rule:
   - Accept      → true
   - Reject      → false
   - AllowExisting → true if (resource == XRD || vault exists for resource)
```

### Authorized Depositor Flow (try_deposit_or_refund)

```
1. is_deposit_allowed? → yes → deposit, return None
2. authorized_depositor_badge provided?
   a. validate_badge_is_authorized_depositor — checks KV store for badge presence
      - Not authorized → emit RejectedDepositEvent, return Some(bucket) [refund] / panic [abort]
      - Authorized → continue
   b. validate_badge_is_present — builds AccessRule, asserts against auth zone
      - Present → deposit, return None
      - Not present → panic
3. No badge → emit RejectedDepositEvent, return Some(bucket) [refund] / panic [abort]
```

### Bottlenose Improvement

`AccountBlueprintBottlenoseExtension` overrides `try_deposit_or_refund` and `try_deposit_batch_or_refund` to catch `AccountError::NotAnAuthorizedDepositor` and return the bucket (refund) instead of panicking. Other errors are propagated.

## Account Creation Flows

### `create()` — Simple

1. Allocates a global address upfront
2. Creates securified role assignment with `ACCOUNT_OWNER_BADGE`
3. Mints an `AccountOwnerBadgeData` NFT
4. Returns `(Global<AccountMarker>, Bucket)` — account + owner badge

### `create_advanced(owner_role, address_reservation)` — Flexible

1. Takes `OwnerRole` (None / Fixed / Updatable) and optional address reservation
2. No owner badge is minted or returned
3. Returns `Global<AccountMarker>` only
4. Supports custom access rules including multi-sig:

```rust
// 2-of-3 multi-sig account
AccountBlueprint::create_advanced(
    OwnerRole::Fixed(rule!(require_n_of(2, vec![
        signature(&pk1), signature(&pk2), signature(&pk3)
    ]))),
    None,
)
```

### Virtual / Preallocated (via `on_virtualize` hook)

1. Triggered by `OnVirtualize` hook with variant IDs:
   - `ACCOUNT_CREATE_PREALLOCATED_SECP256K1_ID` (0)
   - `ACCOUNT_CREATE_PREALLOCATED_ED25519_ID` (1)
2. Creates from public key hash
3. Uses `PresecurifiedRoleAssignment` with `NonFungibleGlobalId::from_public_key_hash`
4. Sets metadata:
   - `"owner_keys"` → `vec![public_key_hash]` (updatable — for ROLA)
   - `"owner_badge"` → badge NFT local ID (locked)
5. Owner badge local ID: `[entity_type_byte] + [public_key_hash_bytes]`

### Modules Attached

Every account gets two attached modules (no royalties):
- `AttachedModuleId::RoleAssignment`
- `AttachedModuleId::Metadata`

## Owner Badge System

### AccountOwnerBadgeData

```rust
pub struct AccountOwnerBadgeData {
    pub name: String,           // immutable
    pub account: ComponentAddress, // immutable
}
```

Resource: `ACCOUNT_OWNER_BADGE` — a well-known non-fungible resource.

### Badge Derivation for Virtual Accounts

```rust
let entity_type = match public_key_hash {
    PublicKeyHash::Ed25519(..) => EntityType::GlobalPreallocatedEd25519Account,
    PublicKeyHash::Secp256k1(..) => EntityType::GlobalPreallocatedSecp256k1Account,
};
let mut id_bytes = vec![entity_type as u8];
id_bytes.extend(public_key_hash.get_hash_bytes());
let local_id = NonFungibleLocalId::bytes(id_bytes).unwrap();
```

Owner identity: `NonFungibleGlobalId::from_public_key_hash(public_key_hash)`.

## Events

```rust
enum WithdrawEvent {
    Fungible(ResourceAddress, Decimal),
    NonFungible(ResourceAddress, IndexSet<NonFungibleLocalId>),
}

enum DepositEvent {
    Fungible(ResourceAddress, Decimal),
    NonFungible(ResourceAddress, IndexSet<NonFungibleLocalId>),
}

enum RejectedDepositEvent {
    Fungible(ResourceAddress, Decimal),
    NonFungible(ResourceAddress, IndexSet<NonFungibleLocalId>),
}

struct SetResourcePreferenceEvent {
    resource_address: ResourceAddress,
    preference: ResourcePreference,
}

struct RemoveResourcePreferenceEvent {
    resource_address: ResourceAddress,
}

struct SetDefaultDepositRuleEvent {
    default_deposit_rule: DefaultDepositRule,
}

struct AddAuthorizedDepositorEvent {
    authorized_depositor_badge: ResourceOrNonFungible,
}

struct RemoveAuthorizedDepositorEvent {
    authorized_depositor_badge: ResourceOrNonFungible,
}
```

## Errors

```rust
pub enum AccountError {
    VaultDoesNotExist { resource_address: ResourceAddress },
    DepositIsDisallowed { resource_address: ResourceAddress },
    NotAllBucketsCouldBeDeposited,
    NotAnAuthorizedDepositor { depositor: ResourceOrNonFungible },
}
```

## Method Ident Constants

```rust
pub const ACCOUNT_BLUEPRINT: &str = "Account";

// Creation
pub const ACCOUNT_CREATE_ADVANCED_IDENT: &str = "create_advanced";
pub const ACCOUNT_CREATE_IDENT: &str = "create";
pub const ACCOUNT_SECURIFY_IDENT: &str = "securify";

// Fee
pub const ACCOUNT_LOCK_FEE_IDENT: &str = "lock_fee";
pub const ACCOUNT_LOCK_CONTINGENT_FEE_IDENT: &str = "lock_contingent_fee";

// Deposit (authenticated)
pub const ACCOUNT_DEPOSIT_IDENT: &str = "deposit";
pub const ACCOUNT_DEPOSIT_BATCH_IDENT: &str = "deposit_batch";

// Deposit (public)
pub const ACCOUNT_TRY_DEPOSIT_OR_REFUND_IDENT: &str = "try_deposit_or_refund";
pub const ACCOUNT_TRY_DEPOSIT_BATCH_OR_REFUND_IDENT: &str = "try_deposit_batch_or_refund";
pub const ACCOUNT_TRY_DEPOSIT_OR_ABORT_IDENT: &str = "try_deposit_or_abort";
pub const ACCOUNT_TRY_DEPOSIT_BATCH_OR_ABORT_IDENT: &str = "try_deposit_batch_or_abort";

// Withdrawal
pub const ACCOUNT_WITHDRAW_IDENT: &str = "withdraw";
pub const ACCOUNT_WITHDRAW_NON_FUNGIBLES_IDENT: &str = "withdraw_non_fungibles";
pub const ACCOUNT_LOCK_FEE_AND_WITHDRAW_IDENT: &str = "lock_fee_and_withdraw";
pub const ACCOUNT_LOCK_FEE_AND_WITHDRAW_NON_FUNGIBLES_IDENT: &str = "lock_fee_and_withdraw_non_fungibles";

// Proof
pub const ACCOUNT_CREATE_PROOF_OF_AMOUNT_IDENT: &str = "create_proof_of_amount";
pub const ACCOUNT_CREATE_PROOF_OF_NON_FUNGIBLES_IDENT: &str = "create_proof_of_non_fungibles";

// Deposit rules
pub const ACCOUNT_SET_DEFAULT_DEPOSIT_RULE_IDENT: &str = "set_default_deposit_rule";
pub const ACCOUNT_SET_RESOURCE_PREFERENCE_IDENT: &str = "set_resource_preference";
pub const ACCOUNT_REMOVE_RESOURCE_PREFERENCE_IDENT: &str = "remove_resource_preference";

// Burn
pub const ACCOUNT_BURN_IDENT: &str = "burn";
pub const ACCOUNT_BURN_NON_FUNGIBLES_IDENT: &str = "burn_non_fungibles";

// Authorized depositors
pub const ACCOUNT_ADD_AUTHORIZED_DEPOSITOR_IDENT: &str = "add_authorized_depositor";
pub const ACCOUNT_REMOVE_AUTHORIZED_DEPOSITOR_IDENT: &str = "remove_authorized_depositor";

// Query (Cuttlefish)
pub const ACCOUNT_BALANCE_IDENT: &str = "balance";
pub const ACCOUNT_NON_FUNGIBLE_LOCAL_IDS_IDENT: &str = "non_fungible_local_ids";
pub const ACCOUNT_HAS_NON_FUNGIBLE_IDENT: &str = "has_non_fungible";
```

## Blueprint Dependencies

```rust
dependencies: indexset!(
    SECP256K1_SIGNATURE_RESOURCE,
    ED25519_SIGNATURE_RESOURCE,
    ACCOUNT_OWNER_BADGE,
    PACKAGE_OF_DIRECT_CALLER_RESOURCE,
)

hooks: { OnVirtualize => "on_virtualize" }
```

## Native SDK Wrapper

`radix-native-sdk/src/account/account.rs`

```rust
pub struct Account(pub ComponentAddress);

impl Account {
    pub fn deposit(&self, bucket: Bucket, api: &mut Y) -> Result<(), E>;
}
```

Minimal wrapper — calls `api.call_method(self.0.as_node_id(), ACCOUNT_DEPOSIT_IDENT, ...)`.

## Multi-Sig Patterns

Accounts support complex authorization via `create_advanced`:

```rust
// Single signature
OwnerRole::Fixed(rule!(require(signature(&pk))))

// 1-of-2
OwnerRole::Fixed(rule!(require_any_of(vec![sig1, sig2])))

// 2-of-2
OwnerRole::Fixed(rule!(require_all_of(vec![sig1, sig2])))

// 2-of-3
OwnerRole::Fixed(rule!(require_n_of(2, vec![sig1, sig2, sig3])))

// Complex boolean
OwnerRole::Fixed(rule!(require(auth0) && require(auth1) || require(auth2)))
```

For mutable multi-sig (key rotation), use `OwnerRole::Updatable(rule)` — the current owner can call `set_owner_role` on the RoleAssignment module.

For AccessController-based multi-sig, the account's owner rule points to an AccessController badge, and the AccessController manages the threshold/key set separately.

## Protocol Evolution

| Version | Extension Struct | Changes |
|---|---|---|
| Babylon | `AccountBlueprint` | Original 27 methods |
| Bottlenose | `AccountBlueprintBottlenoseExtension` | `try_deposit_or_refund` / `try_deposit_batch_or_refund` gracefully refund on `NotAnAuthorizedDepositor` instead of panicking |
| Cuttlefish | `AccountBlueprintCuttlefishExtension` | Added 3 public read-only query methods: `balance`, `non_fungible_local_ids`, `has_non_fungible` |

Each extension is dispatched via separate `NativeCodeId` versions in the package export system.
