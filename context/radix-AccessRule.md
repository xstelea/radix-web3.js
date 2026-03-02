# Radix Access Rule Reference

Technical reference for Radix's access control system. Covers the type hierarchy, role assignment, SBOR encoding, macros, and runtime authorization. Source: `radix-engine-interface/`, `radix-engine/`, `scrypto/`, `radix-common/`.

## Type Hierarchy

```
AccessRule
├── AllowAll
├── DenyAll
└── Protected(CompositeRequirement)
                ├── BasicRequirement(BasicRequirement)
                │     ├── Require(ResourceOrNonFungible)
                │     ├── AmountOf(Decimal, ResourceAddress)
                │     ├── CountOf(u8, Vec<ResourceOrNonFungible>)
                │     ├── AllOf(Vec<ResourceOrNonFungible>)
                │     └── AnyOf(Vec<ResourceOrNonFungible>)
                ├── AnyOf(Vec<CompositeRequirement>)   ← recursive OR
                └── AllOf(Vec<CompositeRequirement>)   ← recursive AND

ResourceOrNonFungible
├── NonFungible(NonFungibleGlobalId)
└── Resource(ResourceAddress)
```

### AccessRule

`radix-engine-interface/src/blueprints/resource/proof_rule.rs:280`

```rust
pub enum AccessRule {
    AllowAll,          // disc 0 — no auth needed
    DenyAll,           // disc 1 — always rejected
    Protected(CompositeRequirement), // disc 2 — evaluate requirement tree
}
```

`CompositeRequirement` converts into `AccessRule::Protected` via `From`.

### CompositeRequirement

`proof_rule.rs:157`

```rust
pub enum CompositeRequirement {
    BasicRequirement(BasicRequirement), // disc 0 (schema name: "ProofRule")
    AnyOf(Vec<CompositeRequirement>),   // disc 1 — any child passes → pass
    AllOf(Vec<CompositeRequirement>),   // disc 2 — all children must pass
}
```

Builder methods: `.or(other)` and `.and(other)` flatten into existing `AnyOf`/`AllOf` when the left side already matches.

Implicit `From` conversions: `ResourceAddress`, `NonFungibleGlobalId`, `ResourceOrNonFungible` all convert into `CompositeRequirement::BasicRequirement(Require(...))`.

### BasicRequirement

`proof_rule.rs:101`

```rust
pub enum BasicRequirement {
    Require(ResourceOrNonFungible),              // disc 0 — single proof present
    AmountOf(Decimal, ResourceAddress),           // disc 1 — proof amount ≥ threshold
    CountOf(u8, Vec<ResourceOrNonFungible>),      // disc 2 — M-of-N proofs present
    AllOf(Vec<ResourceOrNonFungible>),             // disc 3 — all listed proofs present
    AnyOf(Vec<ResourceOrNonFungible>),             // disc 4 — any listed proof present
}
```

### ResourceOrNonFungible

`proof_rule.rs:23`

```rust
pub enum ResourceOrNonFungible {
    NonFungible(NonFungibleGlobalId), // disc 0 — specific NFT
    Resource(ResourceAddress),        // disc 1 — any proof of this resource
}
```

## Helper Functions

`proof_rule.rs:199–261`

| Function | Returns | Purpose |
|---|---|---|
| `require(T)` | `CompositeRequirement` | Wraps anything `Into<CompositeRequirement>` |
| `require_any_of(Vec<T>)` | `CompositeRequirement` | `BasicRequirement::AnyOf` |
| `require_all_of(Vec<T>)` | `CompositeRequirement` | `BasicRequirement::AllOf` |
| `require_n_of(count, Vec<T>)` | `CompositeRequirement` | `BasicRequirement::CountOf` (M-of-N) |
| `require_amount(Decimal, resource)` | `CompositeRequirement` | `BasicRequirement::AmountOf` |
| `signature(public_key)` | `ResourceOrNonFungible` | NFT ID from public key hash (virtual badge) |
| `global_caller(addr)` | `ResourceOrNonFungible` | NFT ID for global caller badge |
| `package_of_direct_caller(pkg)` | `ResourceOrNonFungible` | NFT ID for package caller badge |

### Virtual Badges

Signatures and caller identities are represented as virtual `NonFungibleGlobalId` proofs:

- **`signature(pk)`** → `NonFungibleGlobalId::from_public_key(pk)` — the engine synthesizes this proof when a transaction is signed by `pk`. The resource is the well-known Secp256k1/Ed25519 signature virtual resource.
- **`global_caller(addr)`** → `NonFungibleGlobalId::global_caller_badge(addr)` — synthesized when a component at `addr` calls the protected method.
- **`package_of_direct_caller(pkg)`** → `NonFungibleGlobalId::package_of_direct_caller_badge(pkg)` — synthesized for calls from blueprints in `pkg`.

These virtual proofs are checked via `implicit_non_fungible_proofs` and `simulate_all_proofs_under_resources` in the AuthZone, not actual vault-backed proofs.

## Owner Role System

`role_assignment.rs:243–270`

```rust
pub enum OwnerRole {
    None,              // disc 0 — no owner, maps to DenyAll + updater None
    Fixed(AccessRule), // disc 1 — immutable owner rule, updater None
    Updatable(AccessRule), // disc 2 — mutable owner rule, updater Owner
}
```

Converts to `OwnerRoleEntry`:

| OwnerRole variant | `rule` | `updater` |
|---|---|---|
| `None` | `DenyAll` | `OwnerRoleUpdater::None` |
| `Fixed(rule)` | `rule` | `OwnerRoleUpdater::None` |
| `Updatable(rule)` | `rule` | `OwnerRoleUpdater::Owner` |

### OwnerRoleUpdater

```rust
pub enum OwnerRoleUpdater {
    None,   // immutable
    Owner,  // only current owner can update
    Object, // the component itself can update (used for presecurified objects)
}
```

### Reserved Role Names

| Constant | Value | Meaning |
|---|---|---|
| `OWNER_ROLE` | `"_owner_"` | The owner role; always present |
| `SELF_ROLE` | `"_self_"` | The component itself; resolved to `require(global_caller(self_address))` at runtime |

## Role Assignment System

### RoleKey

`role_assignment.rs:98` — transparent newtype over `String`.

### RoleList

`role_assignment.rs:187` — `Vec<RoleKey>`. Methods are guarded by a `RoleList` that says "any of these roles may call this method." `RoleList::none()` = nobody.

### MethodAccessibility

`role_assignment.rs:34`

```rust
pub enum MethodAccessibility {
    Public,                    // anyone
    OuterObjectOnly,           // only the containing object
    RoleProtected(RoleList),   // any role in the list
    OwnPackageOnly,            // only blueprints in same package
}
```

`MethodAccessibility::nobody()` → `RoleProtected(RoleList::none())`.

### RoleAssignmentInit

`role_assignment.rs:282` — `IndexMap<RoleKey, Option<AccessRule>>`. Maps role names to their access rules. `None` value means "fall through to owner role."

```rust
let mut roles = RoleAssignmentInit::new();
roles.define_role("admin", rule!(require(admin_badge)));
roles.define_role("minter", FallToOwner::OWNER); // None → falls to owner
```

### ToRoleEntry Trait & FallToOwner

`invocations.rs:124–153`

```rust
pub trait ToRoleEntry {
    fn to_role_entry(self) -> Option<AccessRule>;
}

// AccessRule → Some(rule)
// FallToOwner::OWNER → None (delegates to owner role)
// Option<AccessRule> → pass-through
```

When `RoleAssignmentInit` stores `None` for a role, the runtime falls back to the owner's access rule for authorization.

### RoleAssignment CRUD Operations

`invocations.rs`

| Ident | Input | Description |
|---|---|---|
| `"create"` | `OwnerRoleEntry` + `IndexMap<ModuleId, RoleAssignmentInit>` | Initialize role assignment module |
| `"set"` | `ModuleId` + `RoleKey` + `AccessRule` | Update a role's rule |
| `"set_owner"` | `AccessRule` | Update the owner rule (requires current owner auth) |
| `"lock_owner"` | (none) | Make owner immutable (sets updater to None) |
| `"get"` | `ModuleId` + `RoleKey` | Read a role's rule → `Option<AccessRule>` |
| `"get_owner_role"` | (none) | Read owner role entry → `OwnerRoleEntry` |

## Macros

### `rule!` (radix-engine-interface)

`macros.rs:84–95`

```rust
rule!(allow_all)                           // → AccessRule::AllowAll
rule!(deny_all)                            // → AccessRule::DenyAll
rule!(require(signature(pk)))              // → AccessRule::Protected(...)
rule!(require(badge) && require(badge2))   // → Protected(AllOf([..]))
rule!(require(badge) || require(badge2))   // → Protected(AnyOf([..]))
```

`&&` and `||` build `CompositeRequirement::AllOf` / `AnyOf` trees. Grouping with parentheses is supported.

### `enable_method_auth!` (scrypto)

`scrypto/src/macros.rs:416–483` — used inside `#[blueprint]` modules.

```rust
enable_method_auth! {
    roles {
        admin => updatable_by: [OWNER];
        minter => updatable_by: [OWNER, SELF, admin];
    },
    methods {
        mint => restrict_to: [minter];
        burn => restrict_to: [admin, minter];
        get_balance => PUBLIC;
        internal_only => NOBODY;
    }
}
```

Generates `MethodRoles<T>` struct, `ROLE_STRINGS` constants, and `method_auth_template()` function. Role names become struct fields; method names map to `MethodAccessibility` values.

### `enable_function_auth!` (scrypto)

`scrypto/src/macros.rs:486–499` — guards static blueprint functions.

```rust
enable_function_auth! {
    instantiate => rule!(require(admin_badge));
    instantiate_global => rule!(deny_all);
}
```

### `roles!` (scrypto)

`scrypto/src/macros.rs:540–544` — builds `RoleAssignmentInit` at instantiation time.

```rust
let roles = roles! {
    admin => rule!(require(admin_badge));
    minter => FallToOwner::OWNER;
};
```

### `roles2!` (radix-engine-interface)

`macros.rs:105–116` — simpler version, builds `RoleAssignmentInit` directly.

## SBOR Encoding

All types use SBOR Enum encoding (`0x22`). `ROLE_ASSIGNMENT_TYPES_START = 0xe0 (224)`.

### Discriminator Table

| Type | Well-Known ID | Variant | Disc | Fields |
|---|---|---|---|---|
| **AccessRule** | `0xe0` (224) | `AllowAll` | 0 | (none) |
| | | `DenyAll` | 1 | (none) |
| | | `Protected` | 2 | `CompositeRequirement` |
| **CompositeRequirement** | `0xe1` (225) | `BasicRequirement` | 0 | `BasicRequirement` |
| | | `AnyOf` | 1 | `Vec<CompositeRequirement>` |
| | | `AllOf` | 2 | `Vec<CompositeRequirement>` |
| **CompositeRequirementList** | `0xe2` (226) | — | — | `Array<CompositeRequirement>` |
| **BasicRequirement** | `0xe3` (227) | `Require` | 0 | `ResourceOrNonFungible` |
| | | `AmountOf` | 1 | `Decimal`, `ResourceAddress` |
| | | `CountOf` | 2 | `u8`, `Vec<ResourceOrNonFungible>` |
| | | `AllOf` | 3 | `Vec<ResourceOrNonFungible>` |
| | | `AnyOf` | 4 | `Vec<ResourceOrNonFungible>` |
| **ResourceOrNonFungible** | `0xe4` (228) | `NonFungible` | 0 | `NonFungibleGlobalId` |
| | | `Resource` | 1 | `ResourceAddress` |
| **ResourceOrNonFungibleList** | `0xe5` (229) | — | — | `Array<ResourceOrNonFungible>` |
| **OwnerRole** | `0xe6` (230) | `None` | 0 | (none) |
| | | `Fixed` | 1 | `AccessRule` |
| | | `Updatable` | 2 | `AccessRule` |
| **RoleKey** | `0xe7` (231) | — | — | transparent `String` |
| **ModuleId** | (separate range) | `Main` | 0 | |
| | | `Metadata` | 1 | |
| | | `Royalty` | 2 | |
| | | `RoleAssignment` | 3 | |

Schema names preserved for backward compat: `CompositeRequirement` → `"AccessRuleNode"`, `BasicRequirement` → `"ProofRule"`.

### Manifest Text Format Examples

```
# AccessRule::AllowAll
Enum<0u8>()

# AccessRule::DenyAll
Enum<1u8>()

# AccessRule::Protected(BasicRequirement::Require(Resource(xrd_resource)))
Enum<2u8>(
    Enum<0u8>(
        Enum<0u8>(
            Enum<1u8>(
                Address("resource_rdx1...")
            )
        )
    )
)

# SET_OWNER_ROLE instruction
SET_OWNER_ROLE
    Address("${component_address}")
    Enum<0u8>();    # AccessRule::AllowAll

# SET_ROLE instruction
SET_ROLE
    Address("${component_address}")
    Enum<0u8>()     # ModuleId::Main
    "admin"         # role name
    Enum<0u8>();    # AccessRule::AllowAll

# LOCK_OWNER_ROLE instruction
LOCK_OWNER_ROLE
    Address("${component_address}");
```

## Runtime Authorization Flow

`radix-engine/src/system/system_modules/auth/authorization.rs`

### Method Call Authorization

1. Engine resolves `MethodAccessibility` for the called method from the blueprint's static `MethodAuthTemplate`.
2. Based on accessibility:
   - `Public` → authorized immediately
   - `OwnPackageOnly` → checks calling package matches
   - `OuterObjectOnly` → checks caller is the outer object
   - `RoleProtected(role_list)` → tries each role in the list (any-of semantics)

3. For each role key in the list:
   - If key is `"_self_"` → synthesizes `rule!(require(global_caller(self_address)))`
   - Otherwise → looks up `AccessRule` from the component's role assignment substate
   - If no rule stored for that role → falls back to owner role's `AccessRule`

4. `check_authorization_against_access_rule`:
   - `AllowAll` → `Authorized`
   - `DenyAll` → `Failed`
   - `Protected(requirement)` → evaluate recursively

### Requirement Evaluation

`verify_auth_rule` recurses through `CompositeRequirement`:
- `BasicRequirement(rule)` → `verify_proof_rule`
- `AnyOf(rules)` → short-circuit on first pass
- `AllOf(rules)` → short-circuit on first fail

`verify_proof_rule` checks the AuthZone stack:
- `Require(resource)` → any matching proof present?
- `AmountOf(amount, resource)` → proof amount ≥ threshold?
- `CountOf(count, resources)` → ≥ count matching proofs?
- `AllOf(resources)` → all resources have matching proofs?
- `AnyOf(resources)` → any resource has a matching proof?

### AuthZone Stack Traversal

For each `auth_zone_stack_matches` call, the engine checks three sources in order:
1. **Local implicit non-fungible proofs** (signature virtual badges)
2. **Global caller's auth zone** (proofs from the calling component's context)
3. **Current caller's parent auth zone** (proofs from the transaction-level context)

For `NonFungible` rules, the engine also checks `virtual_non_fungibles` and `simulate_all_proofs_under_resources` before iterating actual proofs.

## Common Patterns

### Signature-gated owner

```rust
OwnerRole::Fixed(rule!(require(signature(&public_key))))
```

### Multi-sig owner (M-of-N)

```rust
OwnerRole::Updatable(rule!(require_n_of(
    2,
    vec![signature(&pk1), signature(&pk2), signature(&pk3)]
)))
```

### Badge-gated role with owner fallback

```rust
enable_method_auth! {
    roles {
        admin => updatable_by: [OWNER];
    },
    methods {
        admin_method => restrict_to: [admin];
        public_method => PUBLIC;
    }
}

// At instantiation:
let roles = roles! {
    admin => rule!(require(admin_badge));
};
// or to fall through to owner:
let roles = roles! {
    admin => FallToOwner::OWNER;
};
```

### Component self-authorization

```rust
// _self_ role: only the component itself can call
enable_method_auth! {
    methods {
        internal_callback => restrict_to: [SELF];
    }
}
```
