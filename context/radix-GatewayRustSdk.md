# Radix Gateway Rust SDK Reference

Technical reference for the `radix-client` Rust crate (v1.0.1) — the Gateway and Core API SDK at `.repos/radix-gateway-api-rust`. Provides typed async and blocking HTTP clients for the Radix network APIs.

## Overview

|                   |                                                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Crate**         | `radix-client`                                                                                                                                |
| **Version**       | `1.0.1`                                                                                                                                       |
| **Feature flags** | `gateway` (default), `core` (default)                                                                                                         |
| **Key deps**      | `reqwest` (json, blocking), `serde`, `serde_json`, `serde_path_to_error`, `chrono` (serde), `rust_decimal`, `duplicate`, `maybe-async`, `log` |

The crate exposes two independent API surfaces gated by features:

- **`gateway`** — high-level Gateway API (entity state, transaction streams, KVS)
- **`core`** — low-level Core API (mempool, committed transactions, raw preview)

## Architecture

Dual async/blocking support via `duplicate` + `maybe_async` macros. Each endpoint is written once and expanded into both variants at compile time.

```
src/
├── lib.rs                              # Re-exports
├── client.rs                           # Client structs (Gateway + Core, Async + Blocking)
├── constants.rs                        # PUBLIC_GATEWAY_URL, PUBLIC_CORE_URL
├── deserialize.rs                      # serde_path_to_error wrapper
│
├── gateway/                            # feature = "gateway"
│   ├── builder.rs                      # RequestBuilderAsync/Blocking<R>
│   ├── error.rs                        # GatewayApiError, GatewayApiErrorResponse
│   ├── models.rs                       # All gateway models & enums
│   ├── transaction/
│   │   ├── submit_transaction.rs
│   │   └── preview_transaction.rs
│   ├── state/
│   │   ├── entity_details.rs
│   │   ├── keyvaluestore_data.rs
│   │   ├── keyvaluestore_keys.rs
│   │   └── state_entity_fungibles_page.rs
│   ├── status/
│   │   └── gateway_status.rs
│   └── stream/
│       ├── stream_client.rs            # TransactionStreamAsync/Blocking
│       └── transactions_stream.rs
│
└── core/                               # feature = "core"
    ├── builder.rs                      # RequestBuilderAsync/Blocking<R>
    ├── error.rs                        # CoreApiError, CoreApiErrorResponse
    ├── models.rs                       # All core models & enums
    ├── transaction/
    │   ├── transaction_submit.rs
    │   └── transaction_preview.rs
    ├── mempool/
    │   ├── mempool_list.rs
    │   └── mempool_transaction.rs
    └── stream/
        └── committed_transactions.rs
```

## Client Types

### Gateway Clients

```rust
// Async — uses Arc<reqwest::Client>
pub struct GatewayClientAsync {
    pub base_url: String,
    pub client: Arc<reqwest::Client>,
}

// Blocking — uses Rc<reqwest::blocking::Client>
pub struct GatewayClientBlocking {
    pub base_url: String,
    pub client: Rc<reqwest::blocking::Client>,
}
```

Constructor: `fn new(base_url: String) -> Self`

### Core Clients

```rust
pub struct CoreClientAsync {
    pub base_url: String,
    pub client: Arc<reqwest::Client>,
}

pub struct CoreClientBlocking {
    pub base_url: String,
    pub client: Rc<reqwest::blocking::Client>,
}
```

Constructor: `fn new(base_url: String) -> Self`

### Constants

```rust
pub const PUBLIC_GATEWAY_URL: &str = "https://mainnet.radixdlt.com";
pub const PUBLIC_CORE_URL: &str = "https://radix-mainnet.rpc.grove.city/v1/326002fc/core";
```

### Internal HTTP

All clients expose: `fn post<S: Serialize>(&self, path: &str, body: S) -> Result<(String, StatusCode), reqwest::Error>` (async for Async variants).

## Gateway API Endpoints

All methods exist on both `GatewayClientAsync` (async) and `GatewayClientBlocking` (sync). Signatures shown as async; blocking variants are identical minus `async`/`.await`.

### submit_transaction

```rust
pub async fn submit_transaction(
    &self,
    notarized_transaction_hex: String,
) -> Result<Transactionsubmit200ResponseBody, GatewayApiError>
```

Path: `transaction/submit`. Direct call only.

### preview_transaction

```rust
// Direct
pub async fn preview_transaction(
    &self,
    request: TransactionPreviewRequestBody,
) -> Result<TransactionPreview200ResponseBody, GatewayApiError>

// Builder
pub fn preview_transaction_builder(
    &self,
    manifest: String,
    start_epoch_inclusive: i64,
    end_epoch_exclusive: i64,
    nonce: String,
    signer_public_keys: Vec<PublicKey>,
) -> RequestBuilder<TransactionPreviewRequestBody>
```

Path: `transaction/preview`.

**Builder methods:** `blobs_hex(Vec<String>)`, `notary_public_key(PublicKey)`, `notary_is_signatory(bool)`, `tip_percentage(i32)`, `use_free_credit()`, `assume_all_signature_proofs()`, `skip_epoch_check()`, `fetch()`.

### gateway_status

```rust
pub async fn gateway_status(
    &self,
) -> Result<GetGatewayStatus200Response, GatewayApiError>
```

Path: `status/gateway-status`. Direct call only.

### entity_details

```rust
// Direct
pub async fn entity_details(
    &self,
    request: StateEntityDetailsRequest,
) -> Result<StateEntityDetails200Response, GatewayApiError>

// Builder
pub fn entity_details_builder(
    &self,
    addresses: Vec<String>,
) -> RequestBuilder<StateEntityDetailsRequest>
```

Path: `state/entity/details`.

**Builder methods:** `aggregation_level(AggregationLevel)`, `at_state_version(u64)`, `at_timestamp(DateTime<Utc>)`, `at_epoch(u64)`, `at_round(u64)`, `fetch()`.

### keyvaluestore_keys

```rust
// Direct
pub async fn keyvaluestore_keys(
    &self,
    request: GetKeyValueStoreKeysRequestBody,
) -> Result<GetKeyValueStoreKeys200ResponseBody, GatewayApiError>

// Builder
pub fn keyvaluestore_keys_builder(
    &self,
    key_value_store_address: &str,
) -> RequestBuilder<GetKeyValueStoreKeysRequestBody>
```

Path: `state/key-value-store/keys`.

**Builder methods:** `cursor(String)`, `limit_per_page(u32)`, `at_state_version(u64)`, `at_timestamp(DateTime<Utc>)`, `at_epoch(u64)`, `at_round(u64)`, `fetch()`.

### keyvaluestore_data

```rust
// Direct
pub async fn keyvaluestore_data(
    &self,
    request: GetKeyValueStoreDataRequestBody,
) -> Result<GetKeyValueStoreData200ResponseBody, GatewayApiError>

// Builder
pub fn keyvaluestore_data_builder(
    &self,
    key_value_store_address: String,
) -> RequestBuilder<GetKeyValueStoreDataRequestBody>
```

Path: `state/key-value-store/data`.

**Builder methods:** `with_keys(Vec<StateKeyValueStoreDataRequestKeyItem>)`, `add_key_json(Value)`, `add_key_hex(&str)`, `at_state_version(u64)`, `at_timestamp(DateTime<Utc>)`, `at_epoch(u64)`, `at_round(u64)`, `fetch()`.

### state_entity_fungibles_page

```rust
// Direct
pub async fn state_entity_fungibles_page(
    &self,
    request: StateEntityFungiblesPageRequest,
) -> Result<StateEntityFungiblesPage200Response, GatewayApiError>

// Builder
pub fn state_entity_fungibles_page_builder(
    &self,
    entity_address: &str,
) -> RequestBuilder<StateEntityFungiblesPageRequest>
```

Path: `state/entity/page/fungibles`.

**Builder methods:** `aggregation_level(AggregationLevel)`, `with_explicit_metadata(Vec<String>)`, `cursor(String)`, `limit_per_page(u32)`, `at_state_version(u64)`, `at_timestamp(DateTime<Utc>)`, `at_epoch(u64)`, `at_round(u64)`, `fetch()`.

### transactions_stream

```rust
// Direct
pub async fn transactions_stream(
    &self,
    request: TransactionStreamRequestBody,
) -> Result<TransactionStream200ResponseBody, GatewayApiError>

// Builder
pub fn transactions_stream_builder(
    &self,
) -> RequestBuilder<TransactionStreamRequestBody>
```

Path: `stream/transactions`.

**Builder methods:** `affected_global_entities_filter(Vec<String>)`, `manifest_accounts_deposited_into_filter(Vec<String>)`, `manifest_accounts_withdrawn_from_filter(Vec<String>)`, `manifest_resources_filter(Vec<String>)`, `at_state_version(u64)`, `at_timestamp(DateTime<Utc>)`, `at_epoch(u64)`, `at_round(u64)`, `from_state_version(u64)`, `from_timestamp(DateTime<Utc>)`, `from_epoch(u64)`, `from_round(u64)`, `cursor(String)`, `limit_per_page(u32)`, `with_raw_hex()`, `with_receipt_state_changes()`, `with_receipt_fee_summary()`, `with_receipt_fee_source()`, `with_receipt_fee_destination()`, `with_receipt_costing_parameters()`, `with_receipt_events()`, `with_receipt_output()`, `with_affected_global_entities()`, `with_manifest_instructions()`, `with_balance_changes()`, `order(Order)`, `kind_filter(TransactionKindFilter)`, `fetch()`.

### TransactionStream (Managed Paginator)

```rust
pub struct TransactionStreamAsync {
    pub cursor: Option<String>,
    pub builder: RequestBuilderAsync<TransactionStreamRequestBody>,
    pub last_seen_state_version: u64,
}
// (Blocking variant identical with Blocking types)
```

**Factory:**

```rust
// On GatewayClientAsync / GatewayClientBlocking
pub fn new_transaction_stream(
    &self,
    from_state_version: u64,  // must be > 0, panics otherwise
    limit_per_page: u32,
) -> TransactionStreamAsync  // or TransactionStreamBlocking
```

Initializes with `Order::Asc`, `TransactionKindFilter::User`, `with_receipt_events()`.

**Pagination:**

```rust
pub async fn next(
    &mut self,
) -> Result<TransactionStream200ResponseBody, GatewayApiError>
```

Fetches next page, filters duplicates by `state_version`, advances `last_seen_state_version` and `from_state_version` automatically.

## Core API Endpoints

All methods exist on both `CoreClientAsync` and `CoreClientBlocking`.

### transaction_submit

```rust
pub async fn transaction_submit(
    &self,
    network: String,
    notarized_transaction_hex: String,
) -> Result<Transactionsubmit200ResponseBody, CoreApiError>
```

Path: `transaction/submit`. Direct call only.

### transaction_preview

```rust
// Direct
pub async fn transaction_preview(
    &self,
    request: TransactionPreviewRequestBody,
) -> Result<TransactionPreview200ResponseBody, CoreApiError>

// Builder
pub fn transaction_preview_builder(
    &self,
    manifest: String,
    start_epoch_inclusive: i64,
    end_epoch_exclusive: i64,
    nonce: i64,
    signer_public_keys: Vec<PublicKey>,
    network: String,
    tip_percentage: i32,
) -> RequestBuilder<TransactionPreviewRequestBody>
```

Path: `transaction/preview`.

**Builder methods:** `blobs_hex(Vec<String>)`, `notary_public_key(PublicKey)`, `notary_is_signatory(bool)`, `use_free_credit()`, `assume_all_signature_proofs()`, `skip_epoch_check()`, `fetch()`.

### mempool_list

```rust
pub async fn mempool_list(
    &self,
    network: String,
) -> Result<GetMempoolList200Response, CoreApiError>
```

Path: `mempool/list`. Direct call only.

### mempool_transaction

```rust
pub async fn mempool_transaction(
    &self,
    network: String,
    payload_hashes: Vec<String>,
) -> Result<GetMempoolTransaction200Response, CoreApiError>
```

Path: `mempool/transaction`. Direct call only.

### committed_transactions

```rust
// Direct
pub async fn committed_transactions(
    &self,
    request: GetCommittedTransactionsRequest,
) -> Result<GetCommittedTransactionsRequest, CoreApiError>

// Builder
pub fn committed_transactions_builder(
    &self,
    network: String,
    from_state_version: u64,
    limit: u32,
) -> RequestBuilder<GetCommittedTransactionsRequest>
```

Path: `stream/transactions`.

**Builder methods:** `sbor_format_options(SborFormatOptions)`, `transaction_format_options(TransactionFormatOptions)`, `substate_format_options(SubstateFormatOptions)`, `include_proofs()`, `fetch()`.

## Builder Pattern

Both Gateway and Core define `RequestBuilderAsync<R>` / `RequestBuilderBlocking<R>`:

```rust
pub struct RequestBuilderAsync<R> {
    pub client: GatewayClientAsync,  // or CoreClientAsync
    pub request: R,
}
```

All builders share:

- **`build(&self) -> &R`** — access the underlying request struct
- **`fetch(self)`** — terminal method; sends the POST and deserializes the response
- Chainable setters returning `Self` or `&mut Self` depending on endpoint

Typical usage:

```rust
let details = client
    .entity_details_builder(vec![address.to_string()])
    .aggregation_level(AggregationLevel::Vault)
    .at_state_version(12345)
    .fetch()
    .await?;
```

## Key Models

### Transaction

| Type                                | Purpose                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `TransactionPreviewRequestBody`     | Preview request (manifest, epoch range, nonce, signers, flags)                                                |
| `TransactionPreview200ResponseBody` | Preview result (encoded_receipt, `Receipt`, resource_changes, logs)                                           |
| `TransactionSubmitRequestBody`      | Submit request (notarized_transaction_hex)                                                                    |
| `Transactionsubmit200ResponseBody`  | Submit result (duplicate: bool)                                                                               |
| `CommittedTransactionInfo`          | Full committed tx info (state_version, epoch, round, hashes, receipt, manifest_classes, message)              |
| `TransactionStreamRequestBody`      | Stream query (filters, pagination, opt-ins)                                                                   |
| `TransactionStream200ResponseBody`  | Stream result (ledger_state, items, next_cursor)                                                              |
| `TransactionStreamOptIns`           | Flags for optional data in stream responses                                                                   |
| `PreviewTransactionFlags`           | use_free_credit, assume_all_signature_proofs, skip_epoch_check                                                |
| `Receipt`                           | status, fee_summary, costing_parameters, fee_source/destination, state_updates, events, output, error_message |
| `FeeSummary`                        | Execution/finalization cost units, XRD costs breakdown                                                        |
| `CostingParameters`                 | Unit prices, limits, loans, xrd_usd_price, tip_percentage                                                     |
| `FeeSource` / `FeeDestination`      | Vault sources and proposer/validator/burn/royalty destinations                                                |

### State / Entity

| Type                                                             | Purpose                                                                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `StateEntityDetailsRequest`                                      | Query entity details (addresses, aggregation_level, at_ledger_state)                                    |
| `StateEntityDetails200Response`                                  | Response (ledger_state, items)                                                                          |
| `StateEntityDetailsResponseItem`                                 | Per-entity: address, metadata, fungible/non_fungible resources, details                                 |
| `StateEntityDetailsResponseItemDetails`                          | Tagged enum: Component, FungibleResource, NonFungibleResource, FungibleVault, NonFungibleVault, Package |
| `StateEntityDetailsResponseItemDetailsComponent`                 | package_address, blueprint_name, blueprint_version, state (JSON), role_assignments                      |
| `StateEntityDetailsResponseItemDetailsFungibleResource`          | divisibility, role_assignments, total_supply/minted/burned                                              |
| `StateEntityDetailsResponseItemDetailsNonFungibleResource`       | role_assignments, non_fungible_id_type, total_supply/minted/burned                                      |
| `FungibleResourcesCollection` / `NonFungibleResourcesCollection` | Paginated resource listings                                                                             |
| `FungibleResourcesCollectionItem`                                | resource_address, amount, aggregation_level, explicit_metadata                                          |
| `EntityMetadataCollection` / `EntityMetadataItem`                | Metadata key/value pairs with lock status                                                               |
| `LedgerState`                                                    | network, state_version, proposer_round_timestamp, epoch, round                                          |
| `LedgerStateSelector`                                            | Query by state_version, timestamp, epoch, or round                                                      |

### Key-Value Store

| Type                                   | Purpose                                                     |
| -------------------------------------- | ----------------------------------------------------------- |
| `GetKeyValueStoreKeysRequestBody`      | Query KVS keys (address, pagination, at_ledger_state)       |
| `GetKeyValueStoreKeys200ResponseBody`  | Response (ledger_state, items, next_cursor)                 |
| `GetKeyValueStoreDataRequestBody`      | Query KVS data (address, specific keys)                     |
| `GetKeyValueStoreData200ResponseBody`  | Response (entries with key/value JSON)                      |
| `StateKeyValueStoreDataRequestKeyItem` | Key specifier for data lookups                              |
| `StateKeyValueStoreDataResponseItem`   | key, value (JSON), last_updated_at_state_version, is_locked |
| `ScryptoSborValue`                     | raw_hex + programmatic_json representation                  |

### Mempool (Core)

| Type                               | Purpose                                                              |
| ---------------------------------- | -------------------------------------------------------------------- |
| `GetMempoolList200Response`        | contents: `Vec<MempoolTransactionHashes>`                            |
| `MempoolTransactionHashes`         | intent_hash, intent_hash_bech32m, payload_hash, payload_hash_bech32m |
| `GetMempoolTransaction200Response` | count, payloads: `Vec<MempoolTransactionPayloads>`                   |
| `MempoolTransactionPayloads`       | hash, hash_bech32m, hex, error                                       |

### Committed Transactions (Core)

| Type                              | Purpose                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `GetCommittedTransactionsRequest` | network, from_state_version, limit, format options                              |
| `CommittedTransaction`            | resultant_state_identifiers, ledger_transaction, receipt, proposer_timestamp_ms |
| `NotarizedTransaction`            | hash, hash_bech32m, payload_hex, signed_intent                                  |
| `SignedTransactionIntent`         | hash, hash_bech32m, intent                                                      |
| `TransactionIntent`               | hash, hash_bech32m, header, instructions                                        |
| `TransactionHeader`               | network_id, epoch range, nonce, notary_is_signatory, tip_percentage             |
| `SborFormatOptions`               | raw, programmatic_json                                                          |
| `TransactionFormatOptions`        | manifest, blobs, message, raw_system/notarized/ledger_transaction               |
| `SubstateFormatOptions`           | raw, hash, typed, previous                                                      |

### Common

| Type                          | Purpose                                               |
| ----------------------------- | ----------------------------------------------------- |
| `PublicKey`                   | key_type: `PublicKeyType`, key_hex: `String`          |
| `EntityReference`             | entity_type, is_global, entity_address                |
| `Event`                       | name, emitter (`EventEmitterIdentifier`), data (JSON) |
| `SborData`                    | hex, programmatic_json                                |
| `GetGatewayStatus200Response` | ledger_state, release_info                            |
| `ReleaseInfo`                 | release_version, open_api_schema_version, image_tag   |

## Key Enums

### EntityType (Gateway — 21 variants)

`GlobalPackage`, `GlobalConsensusManager`, `GlobalValidator`, `GlobalGenericComponent`, `GlobalAccount`, `GlobalIdentity`, `GlobalAccessController`, `GlobalVirtualSecp256k1Account`, `GlobalVirtualSecp256k1Identity`, `GlobalVirtualEd25519Account`, `GlobalVirtualEd25519Identity`, `GlobalFungibleResource`, `InternalFungibleVault`, `GlobalNonFungibleResource`, `InternalNonFungibleVault`, `InternalGenericComponent`, `InternalKeyValueStore`, `GlobalOneResourcePool`, `GlobalTwoResourcePool`, `GlobalMultiResourcePool`, `GlobalTransactionTracker`, `GlobalAccountLocker`

Core `EntityType` is identical minus `GlobalAccountLocker`.

### TransactionStatus

`Unknown`, `CommittedSuccess`, `CommittedFailure`, `Pending`, `Rejected`

### ManifestClass

`General`, `Transfer`, `PoolContribution`, `PoolRedemption`, `ValidatorStake`, `ValidatorUnstake`, `ValidatorClaim`, `AccountDepositSettingsUpdate`

### NonFungibleIdType

`String`, `Integer`, `Bytes`, `Ruid`

### Order

`Asc`, `Desc`

### TransactionKindFilter

`User`, `EpochChange`, `All`

### AggregationLevel

`Global`, `Vault`

### PublicKeyType

`EcdsaSecp256k1`, `EddsaEd25519` — Core marks `EcdsaSecp256k1` as `#[default]`.

### StateEntityDetailsResponseItemDetails (tagged)

`Component`, `FungibleResource`, `NonFungibleResource`, `FungibleVault`, `NonFungibleVault`, `Package`

### LedgerTransactionType (Core, tagged)

`Genesis(GenesisLedgerTransaction)`, `User(UserLedgerTransaction)`, `RoundUpdate(RoundUpdateLedgerTransaction)`

### EventEmitterIdentifier (tagged)

`Function { package_address, blueprint_name }`, `Method { entity: EntityReference, object_module_id: ModuleId }`

### TransactionMessage (tagged)

`Plaintext { mime_type, content: PlaintextMessageContent }`

### Other

| Enum                      | Variants                                        |
| ------------------------- | ----------------------------------------------- |
| `ModuleId`                | `Main`, `Metadata`, `Royalty`, `RoleAssignment` |
| `PackageVmType`           | `Native`, `ScryptoV1`                           |
| `LocalTypeIdKind`         | `WellKnown`, `SchemaLocal`                      |
| `PlaintextMessageContent` | `String { value }`, `Binary { value_hex }`      |
| `Status` (Core)           | `Succeeded` (default), `Failed`, `Rejected`     |

## Error Handling

### Gateway — GatewayApiError

```rust
pub enum GatewayApiError {
    Network(reqwest::Error),
    Parsing {
        serde_error: serde_path_to_error::Error<serde_json::Error>,
        response: String,
    },
    ClientError(GatewayApiErrorResponse),
    ServerError(GatewayApiErrorResponse),
    Unknown,
}

pub struct GatewayApiErrorResponse {
    pub message: String,
    pub code: Option<u16>,
    pub details: Option<ErrorDetails>,
    pub trace_id: Option<String>,
}

#[serde(tag = "type")]
pub enum ErrorDetails {
    EntityNotFoundError,
    InvalidEntityError,
    NotSyncedUpError,
    InvalidRequestError,
    InvalidTransactionError,
    TransactionNotFoundError,
    InternalServerError,
}
```

### Core — CoreApiError

```rust
pub enum CoreApiError {
    Network(reqwest::Error),
    Parsing {
        serde_error: serde_path_to_error::Error<serde_json::Error>,
        response: String,
    },
    ClientError(CoreApiErrorResponse),
    ServerError(CoreApiErrorResponse),
    Unknown,
}

#[derive(Debug, Deserialize)]
pub enum CoreApiErrorResponse {
    Basic(ErrorData<()>),
    TransactionSubmit(ErrorData<()>),
    LtsTransactionSubmit(ErrorData<()>),
    StreamTransactions(ErrorData<()>),
    StreamProofs(ErrorData<()>),
}

pub struct ErrorData<T> {
    pub code: u16,
    pub message: String,
    pub trace_id: Option<String>,
    pub details: Option<T>,
}
```

### match_response Pattern

Both Gateway and Core use the same pattern — a free function that maps HTTP status codes:

```rust
pub fn match_response<T: DeserializeOwned>(
    text: String,
    status: StatusCode,
) -> Result<T, GatewayApiError> {  // or CoreApiError
    match status {
        StatusCode::OK => Ok(from_str(&text)?),
        s if s.is_server_error() => Err(ServerError(from_str(&text)?)),
        s if s.is_client_error() => Err(ClientError(from_str(&text)?)),
        _ => Err(Unknown),
    }
}
```

Deserialization uses `serde_path_to_error::deserialize` for precise field-level error messages on malformed responses.

## Usage Examples

### Client Creation

```rust
use radix_client::constants::PUBLIC_GATEWAY_URL;
use radix_client::gateway::GatewayClientAsync;

let client = GatewayClientAsync::new(PUBLIC_GATEWAY_URL.to_string());
```

### Builder Chain

```rust
let response = client
    .entity_details_builder(vec![
        "account_rdx...".to_string(),
        "component_rdx...".to_string(),
    ])
    .aggregation_level(AggregationLevel::Vault)
    .at_state_version(50_000_000)
    .fetch()
    .await?;

for item in response.items {
    println!("{}: {:?}", item.address, item.details);
}
```

### KVS Data Lookup

```rust
let data = client
    .keyvaluestore_data_builder("internal_keyvaluestore_rdx...".to_string())
    .add_key_json(serde_json::json!({
        "kind": "String",
        "value": "my_key"
    }))
    .fetch()
    .await?;

for entry in data.entries {
    println!("{}: {}", entry.key, entry.value);
}
```

### Transaction Stream Pagination

```rust
let mut stream = client.new_transaction_stream(
    1,       // from_state_version (must be > 0)
    100,     // limit_per_page
);

loop {
    let page = stream.next().await?;
    for tx in &page.items {
        println!("sv={} hash={:?}", tx.state_version, tx.intent_hash);
    }
    if page.next_cursor.is_none() {
        break;
    }
}
```

### Error Handling

```rust
match client.gateway_status().await {
    Ok(status) => println!("Epoch: {}", status.ledger_state.epoch),
    Err(GatewayApiError::ClientError(e)) => {
        eprintln!("Client error: {} (trace: {:?})", e.message, e.trace_id);
        if let Some(ErrorDetails::NotSyncedUpError) = e.details {
            eprintln!("Gateway not synced");
        }
    }
    Err(GatewayApiError::Parsing { serde_error, response }) => {
        eprintln!("Parse error at {}: {}", serde_error.path(), serde_error);
    }
    Err(e) => eprintln!("Other: {e}"),
}
```
