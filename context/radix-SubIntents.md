# Radix Subintents Reference

Technical reference for subintents (pre-authorizations) on Radix, the primitive enabling the multisig and governance patterns in this project.

## Overview

A **subintent** is the protocol-level primitive; **pre-authorization** is the user-facing term in wallet UX. Subintents enable composable, atomic transactions where multiple parties contribute signed partial transactions that are combined and executed together.

Launched on mainnet with the **Cuttlefish protocol update** (December 2024).

## What is a Subintent?

A subintent is an independent mini-transaction that:

| Property       | Description                                             |
| -------------- | ------------------------------------------------------- |
| **Identity**   | Unique ID (`subtxid_...` bech32-encoded hash)           |
| **Contents**   | Own manifest, messages, and intent header               |
| **Validity**   | Constraints via min/max epoch or proposer timestamp     |
| **Commitment** | Can only be committed as part of a complete transaction |
| **Structure**  | Forms a tree with parent/child relationships            |

## Execution Model

```
Parent Intent
    │
    ├── YIELD_TO_CHILD ──► Subintent starts executing
    │                      (may receive buckets on worktop)
    │
    ◄── YIELD_TO_PARENT ── Subintent finishes
                           (may return buckets)
```

### Key Rules

- Every subintent **must end** with `YIELD_TO_PARENT`
- Every `YIELD_TO_CHILD` in parent must match a `YIELD_TO_PARENT` in child
- Subintents are **finalized only on success** — can be retried in another transaction if the first fails
- Subintents **cannot lock uncontingent fees** (only contingent) — the root transaction intent handles fees

## Self-Contained Subintents

A subintent is "self-contained" if it:

1. Starts with `ASSERT_WORKTOP_IS_EMPTY` (receives nothing from parent)
2. Has no intermediate `YIELD_TO_PARENT` or `YIELD_TO_CHILD` in body
3. Ends with `YIELD_TO_PARENT` with no arguments (gives nothing back)

Self-contained subintents enable better wallet UX with preview-style reviews and user-settable guarantees.

## Pre-Authorization Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. REQUEST        dApp sends subintent manifest stub + expiry to wallet    │
├─────────────────────────────────────────────────────────────────────────────┤
│  2. REVIEW & SIGN  User reviews, adds guarantees, signs                     │
│                    → Returns SignedPartialTransaction (hex-encoded)         │
├─────────────────────────────────────────────────────────────────────────────┤
│  3. PROPAGATION    dApp relays to aggregator/backend                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  4. SUBMISSION     Aggregator combines intents, notarizes, submits          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### dApp Toolkit Methods

| Method                        | Purpose                      |
| ----------------------------- | ---------------------------- |
| `sendTransaction`             | Standard transaction request |
| `sendPreAuthorizationRequest` | Pre-authorization flow       |

## Wallet Constraints

The Radix Wallet currently requires:

- Pre-authorizations **cannot have children** of their own
- All interaction with other subintents must go through the parent
- Manifest stub must **not include fee locks** (handled by transaction intent)

### Review Modes

| Subintent Type   | Review Style                          |
| ---------------- | ------------------------------------- |
| Self-contained   | Preview-based with user guarantees    |
| GeneralSubintent | Static bounds on withdrawals/deposits |

## Manifest Best Practices

1. Use `ASSERT_...` instructions to guarantee minimum resources for user
2. Withdraw/yield buckets first, deposit at end — maximizes liquidity flexibility
3. Consider `VERIFY_PARENT` to restrict which aggregators can use the subintent
4. For GeneralSubintent classification, follow [conforming manifest guidance](https://docs.radixdlt.com/docs/conforming-manifest-types)

## Use Cases

### Delegated Fees

dApp pays transaction fees so users don't need XRD:

```
1. dApp sends self-contained subintent to user
2. User signs → SignedPartialTransaction
3. dApp backend:
   - Verifies subintent matches expectations
   - Wraps in transaction intent (locks fees from dApp account)
   - Previews, signs/notarizes, submits
```

### Multisig (Our Use Case)

See [multisig-architecture.md](./multisig-architecture.md). Sub-intents solve the fee loan problem:

```
┌────────────────────────────────────────────────┐
│  Problem: Complex access rules exhaust fee     │
│  loan before reaching lock_fee instruction     │
├────────────────────────────────────────────────┤
│  Solution: Submitter (simple account) pays     │
│  fees, sub-intent contains DAO action          │
└────────────────────────────────────────────────┘
```

### Intent-Based Trading

User signs one side of a trade; aggregator finds counterparty:

```
1. User subintent: withdraw X, yield to parent, deposit returned Y
2. Aggregator matches with counterparty subintent
3. Combined transaction executes atomically
```

Example: [Anthic](https://www.anthic.io/) for DEX order matching.

### Coordinated Purchases

Multiple users atomically succeed or fail together (e.g., group ticket purchase).

## Construction & Serialization

### Available Tooling

| Platform                       | Package                    | Status                             |
| ------------------------------ | -------------------------- | ---------------------------------- |
| Rust                           | `radix-transactions` crate | Available                          |
| UniFFI (Python, Swift, Kotlin) | `radix-engine-toolkit`     | Available                          |
| TypeScript                     | Radix Engine Toolkit       | **Not available** (as of Dec 2024) |

### Partial Transaction Builder

```rust
// Rust example
let partial_tx = PartialTransactionBuilder::new()
    .manifest(subintent_manifest)
    .sign(&signer_private_key)
    .build();

// Serialize for transmission
let raw_bytes = partial_tx.to_raw();
```

### Output Format

- `SignedPartialTransaction` — contains single signed subintent (no children)
- Serialize with `to_raw()` (Rust) or `to_payload_bytes()` (toolkit)

## Aggregation

Subintent aggregation is **out-of-band** — the network mempool only operates with complete transactions.

Aggregation services may request:

- Specific metadata
- `VERIFY_PARENT` instruction to restrict usage to their aggregator

## Implementation Example: TAOX

A production Rust implementation from the TAOX NFT project demonstrates the complete aggregator/notary pattern.

Source: [ripsource/TAOX gist](https://gist.github.com/ripsource/1b32761fdc83d9c41a34a58ae1c25183)

### Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User Wallet   │────►│   Rust API      │────►│  Radix Network  │
│                 │     │   (Aggregator)  │     │                 │
│ Signs subintent │     │ Validates,      │     │ Executes atomic │
│ via dApp        │     │ wraps, pays     │     │ transaction     │
│                 │     │ fees, submits   │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Key Dependencies

```rust
use radix_transactions::{
    model::{
        SignedPartialTransactionV2, RawSignedPartialTransaction,
        InstructionV2, InstructionsV2, IntentHeaderV2, TransactionHeaderV2,
    },
    prelude::TransactionBuilder,
    signing::PrivateKey,
};
use radix_client::GatewayClientAsync;
```

### 1. Decode Incoming Subintent

```rust
// Receive hex-encoded SignedPartialTransaction from frontend
let signed_partial_transaction = SignedPartialTransactionV2::from_raw(
    &RawSignedPartialTransaction::from_hex(&subintent_hash_txid)?,
).unwrap();
```

### 2. Validate Manifest Structure (CRITICAL)

**Security requirement:** Validate that the subintent contains exactly the expected instructions. Without this, malicious users could submit arbitrary manifests and drain your notary account.

```rust
fn validate_subintent_structure(instructions: &InstructionsV2) -> Result<(), String> {
    let expected_structure = vec![
        "VerifyParent",
        "CallMethod(withdraw)",
        "TakeAllFromWorktop",
        "CallMethod(withdraw)",
        "TakeAllFromWorktop",
        "YieldToParent",
        "AssertWorktopContains",
        "TakeAllFromWorktop",
        "CallMethod(deposit)",
        "YieldToParent",
    ];

    if instructions.0.len() != expected_structure.len() {
        return Err(format!(
            "Expected {} instructions, found {}",
            expected_structure.len(),
            instructions.0.len()
        ));
    }

    for (i, (instruction, expected)) in instructions.0.iter()
        .zip(expected_structure.iter())
        .enumerate()
    {
        let instruction_type = match instruction {
            InstructionV2::VerifyParent(_) => "VerifyParent",
            InstructionV2::CallMethod(call) => match call.method_name.as_str() {
                "withdraw" => "CallMethod(withdraw)",
                "deposit" => "CallMethod(deposit)",
                other => return Err(format!(
                    "Unexpected method '{}' at instruction {}", other, i
                )),
            },
            InstructionV2::TakeAllFromWorktop(_) => "TakeAllFromWorktop",
            InstructionV2::YieldToParent(_) => "YieldToParent",
            InstructionV2::AssertWorktopContains(_) => "AssertWorktopContains",
            other => return Err(format!(
                "Unexpected instruction at {}: {:?}", i, other
            )),
        };

        if instruction_type != *expected {
            return Err(format!(
                "Expected '{}' at {}, found '{}'", expected, i, instruction_type
            ));
        }
    }
    Ok(())
}
```

### 3. Build Parent Transaction

```rust
use rand::{Rng, SeedableRng};
use rand_chacha::ChaCha20Rng;

let mut rng = ChaCha20Rng::from_entropy();

let transaction_builder = TransactionBuilder::new_v2()
    .transaction_header(TransactionHeaderV2 {
        notary_public_key: notary_private_key.public_key(),
        notary_is_signatory: false,
        tip_basis_points: 0,
    })
    .intent_header(IntentHeaderV2 {
        network_id: network.id,
        start_epoch_inclusive: Epoch::of(network_status.ledger_state.epoch),
        end_epoch_exclusive: Epoch::of(network_status.ledger_state.epoch + 10),
        intent_discriminator: rng.gen::<u64>(),  // Random for uniqueness
        min_proposer_timestamp_inclusive: None,
        max_proposer_timestamp_exclusive: None,
    })
    // Add the user's signed subintent as a child
    .add_signed_child("subintent1", signed_partial_transaction)
    .manifest_builder(|builder| {
        builder
            // Notary account pays fees
            .lock_fee(notary_account_address, 100)
            // Yield to child subintent (starts its execution)
            .yield_to_child("subintent1", ())
            // ... parent logic after subintent yields back ...
            // Take resources from worktop that subintent yielded
            .take_all_from_worktop(resource_address, "bucket")
            // Do something with them
            .call_method_with_name_lookup(component, "method", |lookup| {
                (lookup.bucket("bucket"),)
            })
            // Yield back to subintent with results
            .yield_to_child_with_name_lookup("subintent1", |lookup| {
                (lookup.bucket("result_bucket"),)
            })
    });
```

### 4. Preview Before Submitting

**Cost optimization:** Preview the transaction first. Failed transactions still cost gas.

```rust
// Build preview version
let preview_tx_hex = transaction_builder
    .clone()
    .build_preview_transaction(vec![notary_private_key.public_key()])
    .to_raw()
    .unwrap()
    .to_hex();

// Submit to preview endpoint
let response = client
    .post("https://mainnet.radixdlt.com/transaction/preview-v2")
    .json(&PreviewTransactionRequest {
        preview_transaction: PreviewTransaction {
            transaction_type: "Compiled".to_string(),
            preview_transaction_hex: preview_tx_hex,
        },
        flags: Flags {
            use_free_credit: true,
            assume_all_signature_proofs: true,
            skip_epoch_check: true,
            disable_auth_checks: true,
        },
        opt_ins: OptIns {
            core_api_receipt: true,
            radix_engine_toolkit_receipt: true,
            logs: true,
        },
    })
    .send()
    .await?;

// Check result
let result = response.json::<TransactionPreviewResponse>().await?;
if result.radix_engine_toolkit_receipt.kind != "CommitSuccess" {
    return Err("Preview failed".into());
}
```

### 5. Sign, Notarize, Submit

```rust
let completed_transaction = transaction_builder
    .sign(notary_ed25519_private_key)
    .notarize(&notary_private_key)
    .build();

let transaction_hex = completed_transaction.raw.to_hex();
let transaction_id = hash_encoder.encode(
    &completed_transaction.transaction_hashes.transaction_intent_hash
)?;

// Submit to network
gateway_client.submit_transaction(transaction_hex).await?;
```

### User Subintent Structure

The user's subintent (signed in wallet) follows this pattern:

```
VERIFY_PARENT                     // Restrict to specific aggregator
CALL_METHOD withdraw ...          // Withdraw user resources
TAKE_ALL_FROM_WORKTOP
CALL_METHOD withdraw ...          // Withdraw more resources
TAKE_ALL_FROM_WORKTOP
YIELD_TO_PARENT                   // Give resources to parent
ASSERT_WORKTOP_CONTAINS ...       // Expect specific resources back
TAKE_ALL_FROM_WORKTOP
CALL_METHOD deposit ...           // Deposit to user account
YIELD_TO_PARENT                   // Final yield (required)
```

### Security Checklist

| Check                       | Purpose                                    |
| --------------------------- | ------------------------------------------ |
| Validate instruction count  | Prevent extra malicious instructions       |
| Validate instruction types  | Ensure only expected operations            |
| Validate method names       | Prevent calls to unexpected methods        |
| Validate resource addresses | Ensure correct tokens being moved          |
| Preview before submit       | Avoid paying gas for failures              |
| Use `VERIFY_PARENT`         | Restrict subintent to your aggregator only |

## Implementation Example: Multi-Signature Subintent

A simpler example demonstrating **combining multiple signatures** on a single subintent - directly relevant to DAO multisig.

Source: [gguuttss/sub-intent-example](https://github.com/gguuttss/sub-intent-example/blob/main/src/bin/multi_sign.rs)

### Use Case

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Wallet Signer  │────►│  Backend adds   │────►│  Notary wraps   │
│                 │     │  2nd signature  │     │  & submits      │
│ Signs subintent │     │  (programmatic) │     │  (pays fees)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

This pattern applies when:

- A DAO action needs multiple signers
- One signer uses wallet, another is programmatic
- Final submission pays fees from a separate notary account

### 1. Parse Wallet-Signed Subintent

```rust
use radix_transactions::model::{
    RawSignedPartialTransaction, SignedPartialTransactionV2,
    IntentSignatureV1, IntentSignaturesV2,
};

// Receive hex-encoded SignedPartialTransaction from wallet
let signed_bytes = hex_to_bytes(wallet_signed_hex)?;
let raw_signed = RawSignedPartialTransaction::from_vec(signed_bytes);

let wallet_signed: SignedPartialTransactionV2 =
    SignedPartialTransactionV2::from_raw(&raw_signed)
        .map_err(|e| format!("Failed to parse: {:?}", e))?;

println!("Wallet signatures: {}",
    wallet_signed.root_subintent_signatures.signatures.len());
```

### 2. Get Subintent Hash for Signing

```rust
use radix_transactions::prelude::{PreparationSettings, HasSubintentHash};

// Prepare the partial transaction to extract subintent hash
let prepared = wallet_signed.partial_transaction
    .prepare(&PreparationSettings::latest_ref())
    .map_err(|e| format!("Failed to prepare: {:?}", e))?;

let subintent_hash = prepared.subintent_hash();
```

### 3. Add Programmatic Signature

```rust
// Sign the same subintent hash with programmatic key
let programmatic_signature = programmatic_private_key
    .sign_with_public_key(&subintent_hash);

// Combine wallet + programmatic signatures
let mut combined_signatures = wallet_signed
    .root_subintent_signatures.signatures.clone();
combined_signatures.push(IntentSignatureV1(programmatic_signature));

// Create multi-signed subintent
let multi_signed = SignedPartialTransactionV2 {
    partial_transaction: wallet_signed.partial_transaction,
    root_subintent_signatures: IntentSignaturesV2 {
        signatures: combined_signatures,
    },
    non_root_subintent_signatures: wallet_signed.non_root_subintent_signatures,
};
```

### 4. Wrap in Parent Transaction

```rust
let completed_tx = TransactionBuilder::new_v2()
    .transaction_header(TransactionHeaderV2 {
        notary_public_key: notary_private_key.public_key(),
        notary_is_signatory: false,
        tip_basis_points: 0,
    })
    .intent_header(IntentHeaderV2 {
        network_id: network.id,
        start_epoch_inclusive: Epoch::of(current_epoch),
        end_epoch_exclusive: Epoch::of(current_epoch + 100),
        intent_discriminator: rand::random::<u64>(),
        min_proposer_timestamp_inclusive: None,
        max_proposer_timestamp_exclusive: None,
    })
    // Add multi-signed subintent as child
    .add_signed_child("subintent", multi_signed)
    .manifest_builder(|builder| {
        builder
            .lock_fee(notary_address, Decimal::from(100u32))
            .yield_to_child("subintent", ())
            .deposit_entire_worktop(notary_address)
    })
    .sign(&notary_private_key)
    .notarize(&notary_private_key)
    .build();
```

### 5. Submit and Monitor

```rust
// Get intent hash for tracking
let intent_hash = hash_encoder
    .encode(&completed_tx.transaction_hashes.transaction_intent_hash)?;

// Submit
let tx_hex = completed_tx.raw.to_hex();
submit_transaction(&tx_hex).await?;

// Poll for status
loop {
    let status = check_transaction_status(&intent_hash).await?;
    match status.as_str() {
        "CommittedSuccess" => break Ok(()),
        "CommittedFailure" => break Err("Transaction failed"),
        "Pending" | "Unknown" => {
            tokio::time::sleep(Duration::from_secs(2)).await;
        }
        _ => break Err(format!("Unexpected status: {}", status)),
    }
}
```

### Key Differences from TAOX Example

| Aspect         | TAOX                         | Multi-Sign                      |
| -------------- | ---------------------------- | ------------------------------- |
| **Signatures** | Single signer (user)         | Multiple signers combined       |
| **Validation** | Strict manifest validation   | Trust wallet-signed content     |
| **Use case**   | Delegated fees / NFT minting | DAO multisig actions            |
| **Complexity** | Parent does complex work     | Parent just yields and deposits |

### Relevance to DAO Multisig

This pattern directly supports the [multisig architecture](./multisig-architecture.md):

1. **DAO member 1** signs subintent via wallet → `SignedPartialTransaction`
2. **DAO member 2** (or backend) adds second signature → combined signatures
3. **Orchestrator/Notary** wraps in parent, pays fees, submits
4. **Network** validates both signatures against access rule

## References

- [Radix Docs: Subintents](https://docs.radixdlt.com/docs/subintents)
- [Radix Docs: Pre-authorization Flow](https://docs.radixdlt.com/docs/pre-authorizations-and-subintents)
- [Transaction Structure](https://docs.radixdlt.com/docs/transaction-structure)
- [Conforming Manifest Types](https://docs.radixdlt.com/docs/conforming-manifest-types)
- [TAOX Rust Implementation](https://gist.github.com/ripsource/1b32761fdc83d9c41a34a58ae1c25183) — Production example of subintent aggregation
- [Multi-Sign Example](https://github.com/gguuttss/sub-intent-example) — Combining multiple signatures on subintents
- [Multisig Architecture](./multisig-architecture.md)
