# Radix Gateway — Deep Analysis

## Overview

`@radix-effects/gateway` is a production-grade Effect wrapper around the Radix Gateway API (~2,150 LOC). It converts the SDK's Promise-based methods into typed Effects with tagged errors, automatic 429 retry, exhaustive pagination, chunked batching, and concurrency control.

Key properties:

- **One core service, many composites** — `GatewayApiClient` wraps the SDK; 17+ higher-level services compose on top
- **Tagged error mapping** — SDK `ResponseError` → 12 discriminated `Data.TaggedError` classes
- **Automatic rate-limit retry** — 429 detected via `fetchResponse.status`, sleeps `retryAfter` seconds, retries
- **Dual schema system** — Zod for `AtLedgerState` validation, Effect Schema for SBOR types
- **All config via `Effect.Config`** — not `process.env`; 12+ config keys with sensible defaults

**Source:** `.repos/radix-effects/packages/gateway/src/` (24 files + helpers)
**Dependencies:** `effect`, `@radixdlt/babylon-gateway-api-sdk`, `@radixdlt/rola`, `@radixdlt/radix-engine-toolkit`, `sbor-ez-mode`, `bignumber.js`, `zod`

---

## Architecture

```
                 ┌────────────────────────────────────────────────────┐
                 │              GatewayApiClient (Effect.Service)     │
                 │                                                    │
  Config keys:   │  wrapMethod(fn) → Effect.tryPromise + error map   │
  NETWORK_ID     │    ├─ ResponseError → tagged error by .type        │
  GATEWAY_URL    │    ├─ 429 → RateLimitExceededError + sleep+retry   │
  BASIC_AUTH     │    └─ unknown → UnknownGatewayError                │
                 │                                                    │
                 │  .state  .stream  .transaction  .status .extensions│
                 └───────────┬────────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────────────┐
         ▼                   ▼                           ▼
   ┌─── State Services ──┐  │  ┌── Composite Services ─────────────┐
   │ EntityFungiblesPage │  │  │ GetFungibleBalance                │
   │ EntityNonFungibles  │  │  │ GetNonFungibleBalance             │
   │ EntityNonFungibleIds│  │  │ GetNftResourceManagers            │
   │ StateEntityDetails  │  │  │ GetKeyValueStore                  │
   │ GetEntityDetailsVA  │  │  │ GetComponentState (+ sbor-ez-mode)│
   │ NonFungibleData     │  │  │ GetAddressByNonFungible           │
   │ GetValidators       │  │  │ GetResourceHolders                │
   └─────────────────────┘  │  │ GetLedgerState                    │
                             │  │ GetNonFungibleLocation            │
   ┌─── KVS Services ────┐  │  │ PreviewTransaction                │
   │ KeyValueStoreKeys   │  │  │ Rola (proof verification)         │
   │ KeyValueStoreData   │  │  └───────────────────────────────────┘
   └─────────────────────┘  │
                             │
                   ┌─────────┴──────┐
                   │ helpers/chunker│
                   └────────────────┘
```

**Dependency flow:** Composite services declare `dependencies: [X.Default]` so Effect's Layer system auto-wires the tree. For example, `GetFungibleBalance` depends on `EntityFungiblesPage.Default` + `StateEntityDetails.Default`, which both depend on `GatewayApiClient`.

---

## Core Types

### GatewayApiClient

The central `Effect.Service`. Reads config at construction, initializes the SDK client, then wraps every SDK method via `wrapMethod`:

```typescript
class GatewayApiClient extends Effect.Service<GatewayApiClient>()(
  'GatewayApiClient',
  { effect: Effect.gen(function* () { ... }) }
) {}
```

**Shape of the resolved service:**

```typescript
{
  networkId: number
  state: {
    getEntityDetailsVaultAggregated(addresses, options, at_ledger_state)
    getValidators()
    innerClient: {
      stateEntityDetails, entityFungiblesPage, entityNonFungiblesPage,
      entityNonFungibleIdsPage, entityNonFungibleResourceVaultPage,
      keyValueStoreKeys, keyValueStoreData, nonFungibleData,
      nonFungibleLocation, nonFungibleIds
    }
  }
  stream: { innerClient: { streamTransactions } }
  transaction: {
    getCommittedDetails(txHash, optIns, at_ledger_state)
    innerClient: { transactionSubmit, transactionStatus, transactionPreview }
  }
  status: { getCurrent(); innerClient: { gatewayStatus } }
  extensions: { getResourceHolders(resourceAddress, cursor?) }
  rawClient: GatewayApiClientSdk  // escape hatch
}
```

### AtLedgerState (Zod)

```typescript
type AtLedgerState = { state_version: number } | { timestamp: Date };
```

Validated by `AtLedgerStateSchema` (Zod union). Used in virtually every service to pin queries to a ledger point.

### Validator

```typescript
type Validator = {
  address: string;
  name: string;
  lsuResourceAddress: string;
  claimNftResourceAddress: string;
};
```

Parsed from validator metadata in `state/getValidators.ts`.

### ROLA Proof Schemas (Effect Schema)

```typescript
Proof:        { publicKey, signature, curve: 'curve25519' | 'secp256k1' }
PersonaProof: { address, type: 'persona', challenge, proof: Proof }
AccountProof: { address, type: 'account', challenge, proof: Proof }
RolaProof:    PersonaProof | AccountProof
```

---

## Error Types

All use `Data.TaggedError` from Effect (except 3 legacy class-based errors):

| #   | Error                        | `_tag`                         | Source                                              |
| --- | ---------------------------- | ------------------------------ | --------------------------------------------------- |
| 1   | `AccountLockerNotFoundError` | `'AccountLockerNotFoundError'` | SDK type mapping                                    |
| 2   | `InternalServerError`        | `'InternalServerError'`        | SDK type mapping                                    |
| 3   | `InvalidRequestError`        | `'InvalidRequestError'`        | SDK type mapping                                    |
| 4   | `InvalidEntityError`         | `'InvalidEntityError'`         | SDK type mapping                                    |
| 5   | `EntityNotFoundError`        | `'EntityNotFoundError'`        | SDK type mapping                                    |
| 6   | `NotSyncedUpError`           | `'NotSyncedUpError'`           | SDK type mapping                                    |
| 7   | `TransactionNotFoundError`   | `'TransactionNotFoundError'`   | SDK type mapping                                    |
| 8   | `InvalidTransactionError`    | `'InvalidTransactionError'`    | SDK type mapping                                    |
| 9   | `ResponseError`              | `'ResponseError'`              | SDK fallback (has errorResponse but unknown type)   |
| 10  | `ErrorResponse`              | `'ErrorResponse'`              | SDK errorResponse present but no details.type match |
| 11  | `RateLimitExceededError`     | `'RateLimitExceededError'`     | HTTP 429 detected via `fetchResponse.status`        |
| 12  | `UnknownGatewayError`        | `'UnknownGatewayError'`        | Catch-all for non-SDK errors                        |
| 13  | `VerifyRolaProofError`       | `'VerifyRolaProofError'`       | ROLA verification failure                           |
| 14  | `TransactionPreviewError`    | `'TransactionPreviewError'`    | Preview returns error receipt                       |
| —   | `InvalidStateInputError`     | `'InvalidStateInputError'`     | Zod validation of AtLedgerState (legacy class)      |
| —   | `InvalidComponentStateError` | `'InvalidComponentStateError'` | sbor-ez-mode parse failure (legacy class)           |
| —   | `InvalidInputError`          | `'InvalidInputError'`          | Service input validation (legacy class)             |

Errors 1–8 carry the SDK error fields plus `{ code?: number; message?: string }`.

---

## Service Catalog

| Service                           | Input                                            | Output                                            | Dependencies                                     | Config                                                                    |
| --------------------------------- | ------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| `GetLedgerStateService`           | `at_ledger_state`                                | `ledger_state`                                    | GatewayApiClient                                 | —                                                                         |
| `GetComponentStateService`        | addresses, at_ledger_state, sbor-ez-mode schema  | `[{address, state, details}]`                     | GetEntityDetailsVaultAggregated                  | —                                                                         |
| `GetFungibleBalance`              | addresses, at_ledger_state                       | `[{address, items: [{amount: BigNumber, ...}]}]`  | EntityFungiblesPage, StateEntityDetails          | `GET_FUNGIBLE_BALANCE_CONCURRENCY` (5)                                    |
| `GetNonFungibleBalance`           | addresses, at_ledger_state, resourceAddresses?   | `{items: [{address, nonFungibleResources}]}`      | NonFungibleData, GetNftResourceManagers          | `GET_NON_FUNGIBLE_DATA_CONCURRENCY` (15)                                  |
| `GetNftResourceManagersService`   | addresses, at_ledger_state, resourceAddresses?   | `[{address, items: [{resourceAddress, nftIds}]}]` | EntityNonFungiblesPage, EntityNonFungibleIdsPage | 4 config keys (see Config table)                                          |
| `GetKeyValueStore`                | address, at_ledger_state                         | `{key_value_store_address, entries}`              | KeyValueStoreKeys, KeyValueStoreData             | —                                                                         |
| `KeyValueStoreKeysService`        | KVS request + at_ledger_state                    | paginated keys                                    | GatewayApiClient                                 | `MaxPageSize` (100)                                                       |
| `KeyValueStoreDataService`        | KVS data request + at_ledger_state               | chunked data array                                | GatewayApiClient                                 | `MaxPageSize` (100)                                                       |
| `GetResourceHoldersService`       | resourceAddress, cursor?                         | deduplicated holders array                        | GatewayApiClient                                 | —                                                                         |
| `GetAddressByNonFungibleService`  | resourceAddress, nonFungibleId, at_ledger_state  | `{address, resourceAddress, nonFungibleId}`       | GetNonFungibleLocation                           | —                                                                         |
| `GetNonFungibleLocationService`   | resourceAddress, nonFungibleIds, at_ledger_state | flat locations array                              | GatewayApiClient                                 | `MaxPageSize` (100)                                                       |
| `GetValidators`                   | —                                                | `Validator[]`                                     | GatewayApiClient                                 | —                                                                         |
| `PreviewTransaction`              | TransactionPreviewRequest payload                | preview result                                    | GatewayApiClient                                 | —                                                                         |
| `Rola`                            | `RolaProof`                                      | void (or `VerifyRolaProofError`)                  | GatewayApiClient                                 | `DAPP_DEFINITION_ADDRESS`, `ROLA_EXPECTED_ORIGIN`, `APPLICATION_NAME`     |
| `EntityFungiblesPage`             | entity fungibles request + at_ledger_state       | all items (exhaustive)                            | GatewayApiClient                                 | `MaxPageSize` (100)                                                       |
| `EntityNonFungiblesPage`          | entity non-fungibles request + at_ledger_state   | single page result                                | GatewayApiClient                                 | `MaxPageSize` (100)                                                       |
| `EntityNonFungibleIdsPage`        | vault, resource, address, at_ledger_state        | `{ids, address}` (exhaustive)                     | GatewayApiClient                                 | `StateEntityDetailsPageSize` (100)                                        |
| `GetEntityDetailsVaultAggregated` | addresses, options, at_ledger_state              | flat entity details array                         | GatewayApiClient                                 | `StateEntityDetailsPageSize` (20)                                         |
| `StateEntityDetails`              | addresses + options                              | `{ledger_state, items}`                           | GatewayApiClient                                 | `StateEntityDetailsPageSize` (20), `STATE_ENTITY_DETAILS_CONCURRENCY` (5) |
| `NonFungibleData`                 | NFT data request + at_ledger_state               | flat NFT data array                               | GatewayApiClient                                 | `MaxPageSize` (100)                                                       |

---

## Pagination & Batching

### Exhaustive Cursor Pattern

Used by: `EntityFungiblesPage`, `EntityNonFungibleIdsPage`, `GetKeyValueStore`, `GetResourceHoldersService`

```typescript
const items = [...initialResult.items];
let nextCursor = initialResult.next_cursor;

while (nextCursor) {
  const result = yield * service({ ...input, cursor: nextCursor });
  items.push(...result.items);
  nextCursor = result.next_cursor;
}
return items;
```

Drains all pages until `next_cursor` is `undefined`.

### Chunked Batching Pattern

Used by: `GetEntityDetailsVaultAggregated`, `StateEntityDetails`, `KeyValueStoreDataService`, `NonFungibleData`

```typescript
const chunks = chunker(addresses, pageSize); // split into N-sized arrays
const results =
  yield * Effect.forEach(chunks, (chunk) => service(chunk), { concurrency: N });
return results.flat();
```

### Chunker Utility

```typescript
// helpers/chunker.ts — 10 LOC
const chunker = <T>(array: T[], size: number): T[][] =>
  array.reduce((acc, item, index) => {
    const chunkIndex = Math.floor(index / size);
    if (!acc[chunkIndex]) acc[chunkIndex] = [];
    acc[chunkIndex].push(item);
    return acc;
  }, [] as T[][]);
```

### Concurrency Control

Services like `GetFungibleBalance` and `GetNftResourceManagers` use `Effect.forEach` with `{ concurrency: N }` to limit parallel Gateway API calls. Each concurrency limit is independently configurable.

---

## Error Handling

### Error Mapping Pipeline

The `wrapMethod` function in `gatewayApiClient.ts` is the single point of error translation:

```
SDK Promise rejects
  │
  ├─ instanceof ResponseError?
  │   ├─ has errorResponse.details.type?
  │   │   └─ switch on type → tagged error (1-8)
  │   ├─ has errorResponse but no matching type?
  │   │   └─ ErrorResponse
  │   ├─ fetchResponse.status === 429?
  │   │   └─ RateLimitExceededError { retryAfter: header value }
  │   └─ otherwise → ResponseError
  │
  └─ not ResponseError → UnknownGatewayError { error }
```

### Rate-Limit Retry

Built into `wrapMethod` — every wrapped SDK call gets automatic 429 handling:

```typescript
(Effect.tapError((error) => {
  if (error._tag === "RateLimitExceededError") {
    yield * Effect.logWarning(`Rate limit, retrying in ${error.retryAfter}s`);
    yield * Effect.sleep(Duration.seconds(error.retryAfter));
  }
}),
  Effect.retry({ while: (e) => e._tag === "RateLimitExceededError" }));
```

The `retryAfter` value is parsed from the `retry-after` HTTP header. The sleep happens inside `tapError` (before the retry), so the retry fires immediately after the sleep completes.

---

## SBOR Schema

`sbor.ts` defines an Effect Schema recursive union representing all 21 Scrypto SBOR value kinds returned by the Gateway API.

### Kind Literal

```typescript
const ScryptoSborValueKind = Schema.Literal(
  "Bool",
  "I8",
  "I16",
  "I32",
  "I64",
  "I128",
  "U8",
  "U16",
  "U32",
  "U64",
  "U128",
  "String",
  "Enum",
  "Array",
  "Bytes",
  "Map",
  "Tuple",
  "Reference",
  "Own",
  "Decimal",
  "PreciseDecimal",
  "NonFungibleLocalId"
);
```

### Primitive Types (Schema.Struct)

All share a base with optional `type_name` and `field_name`:

| Kind                        | Value Type    | Notes                         |
| --------------------------- | ------------- | ----------------------------- |
| `Bool`                      | `boolean`     |                               |
| `String`                    | `string`      |                               |
| `I8`..`I128`, `U8`..`U128`  | `string`      | Strings to preserve precision |
| `Decimal`, `PreciseDecimal` | `string`      |                               |
| `Reference`, `Own`          | `string`      | Radix address                 |
| `NonFungibleLocalId`        | `string`      |                               |
| `Bytes`                     | `hex: string` | Also has `element_kind`       |

### Recursive Types (Schema.suspend)

Four types reference `ScryptoSborValueSchema` recursively, requiring `Schema.suspend()` to break the circular reference:

```typescript
// Array — elements contain any SBOR value
const ScryptoSborValueArraySchema = Schema.suspend(() =>
  Schema.Struct({
    kind: Schema.Literal("Array"),
    element_kind: ScryptoSborValueKind,
    elements: Schema.Array(ScryptoSborValueSchema), // recursive
  })
);

// Map — key/value pairs are each any SBOR value
const ScryptoSborValueMapEntrySchema = Schema.suspend(() =>
  Schema.Struct({
    key: ScryptoSborValueSchema, // recursive
    value: ScryptoSborValueSchema, // recursive
  })
);

// Tuple — fields are any SBOR value
// Enum — variant with fields that are any SBOR value
```

### Final Union

```typescript
export const ScryptoSborValueSchema = Schema.Union(
  ScryptoSborValueBool,       // primitives first (no suspension needed)
  ScryptoSborValueString,
  ... (14 more primitives),
  ScryptoSborValueArraySchema,  // recursive types last (use Schema.suspend)
  ScryptoSborValueMapSchema,
  ScryptoSborValueTupleSchema,
  ScryptoSborValueEnumSchema,
)
```

Order matters: primitives first for faster discriminant matching, recursive types last.

---

## Configuration

All config is read via `Effect.Config` — never directly from `process.env`.

| Config Key                                         | Default                    | Used By                                                                                             |
| -------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------- |
| `NETWORK_ID`                                       | `1` (mainnet)              | GatewayApiClient                                                                                    |
| `GATEWAY_URL`                                      | `undefined` (SDK default)  | GatewayApiClient                                                                                    |
| `APPLICATION_NAME`                                 | `'@radix-effects/gateway'` | GatewayApiClient, Rola                                                                              |
| `GATEWAY_BASIC_AUTH`                               | `undefined`                | GatewayApiClient (→ `Authorization: Basic {value}`)                                                 |
| `GatewayApi__Endpoint__StateEntityDetailsPageSize` | `20`                       | StateEntityDetails, GetEntityDetailsVA, EntityNonFungibleIdsPage, GetNftResourceManagers            |
| `GatewayApi__Endpoint__MaxPageSize`                | `100`                      | KVS Keys/Data, NonFungibleData, EntityFungiblesPage, EntityNonFungiblesPage, GetNonFungibleLocation |
| `GATEWAY_STATE_ENTITY_DETAILS_CONCURRENCY`         | `5`                        | StateEntityDetails, GetNftResourceManagers                                                          |
| `GATEWAY_GET_FUNGIBLE_BALANCE_CONCURRENCY`         | `5`                        | GetFungibleBalance                                                                                  |
| `GATEWAY_GET_NON_FUNGIBLE_DATA_CONCURRENCY`        | `15`                       | GetNonFungibleBalance                                                                               |
| `GET_NFT_RESOURCE_MANAGERS_CONCURRENCY`            | `10`                       | GetNftResourceManagers                                                                              |
| `GET_NFT_IDS_CONCURRENCY`                          | `20`                       | GetNftResourceManagers                                                                              |
| `DAPP_DEFINITION_ADDRESS`                          | _(required)_               | Rola                                                                                                |
| `ROLA_EXPECTED_ORIGIN`                             | _(required)_               | Rola                                                                                                |

---

## Usage Patterns

### Providing GatewayApiClient.Default

```typescript
import { GatewayApiClient } from "@radix-effects/gateway";
import { ConfigProvider, Effect, Layer } from "effect";

const program = Effect.gen(function* () {
  const gateway = yield* GatewayApiClient;
  const status = yield* gateway.status.getCurrent();
  console.log(status.ledger_state.state_version);
});

program.pipe(
  Effect.provide(GatewayApiClient.Default),
  // Config keys read from ConfigProvider (env vars by default)
  Effect.runPromise
);
```

### Querying Fungible Balance

```typescript
import { GetFungibleBalance } from "@radix-effects/gateway";

const program = Effect.gen(function* () {
  const svc = yield* GetFungibleBalance;
  const balances = yield* svc({
    addresses: ["account_rdx1..."],
    at_ledger_state: { state_version: 123456 },
  });
  // balances[0].items[0].amount → BigNumber
});

program.pipe(Effect.provide(GetFungibleBalance.Default), Effect.runPromise);
```

### Reading Key-Value Store

```typescript
import { GetKeyValueStore } from "@radix-effects/gateway";

const program = Effect.gen(function* () {
  const svc = yield* GetKeyValueStore;
  const kvs = yield* svc({
    address: "internal_keyvaluestore_rdx1...",
    at_ledger_state: { state_version: 123456 },
  });
  // kvs.entries → all key-value pairs (exhaustive pagination)
});

program.pipe(Effect.provide(GetKeyValueStore.Default), Effect.runPromise);
```

### Component State with sbor-ez-mode Schema

```typescript
import { GetComponentStateService } from "@radix-effects/gateway";
import { Struct, String, U64 } from "sbor-ez-mode";

const MyComponentSchema = Struct({ name: String, count: U64 });

const program = Effect.gen(function* () {
  const svc = yield* GetComponentStateService;
  const results = yield* svc.run({
    addresses: ["component_rdx1..."],
    at_ledger_state: { state_version: 123456 },
    schema: MyComponentSchema,
  });
  // results[0].state.name → string, results[0].state.count → string
});

program.pipe(
  Effect.provide(GetComponentStateService.Default),
  Effect.runPromise
);
```

### ROLA Verification

```typescript
import { Rola } from "@radix-effects/gateway";

const program = Effect.gen(function* () {
  const rola = yield* Rola;
  yield* rola.verifySignedChallenge({
    address: "account_rdx1...",
    type: "account",
    challenge: "abc123",
    proof: { publicKey: "...", signature: "...", curve: "curve25519" },
  });
});

program.pipe(
  Effect.provide(Rola.Default),
  // Must provide: DAPP_DEFINITION_ADDRESS, ROLA_EXPECTED_ORIGIN
  Effect.runPromise
);
```

---

## Gotchas

### 1. Dual Schema System (Zod + Effect Schema)

`AtLedgerState` uses **Zod** (`schemas.ts`), while SBOR types use **Effect Schema** (`sbor.ts`). These are not interchangeable. When validating ledger state input, use `validateAtLedgerStateInput` (Zod). When decoding SBOR values, use `ScryptoSborValueSchema` (Effect Schema).

### 2. All Config via Effect Config (Not process.env)

Services read config through `Config.string(...)` / `Config.number(...)`. You must provide values through Effect's `ConfigProvider`, not by setting `process.env` directly (though the default `ConfigProvider` reads from env vars). To override in tests:

```typescript
Effect.provide(
  Layer.setConfigProvider(
    ConfigProvider.fromMap(
      new Map([
        ["NETWORK_ID", "2"], // stokenet
      ])
    )
  )
);
```

### 3. Chunker Page-Size Limits

The `chunker` splits arrays into fixed-size chunks matching the Gateway API's max page size (typically 20 or 100). If you pass more addresses than the page size to `GetEntityDetailsVaultAggregated`, it auto-chunks. But the page size itself is configurable — ensure your config matches Gateway API limits.

### 4. Services Require Full Dependency Tree via Layer.provide

Higher-level services declare `dependencies:` but this only wires one level. `GatewayApiClient.Default` must still be in scope. For composite services, the simplest approach:

```typescript
Effect.provide(GetFungibleBalance.Default);
// GetFungibleBalance.Default auto-includes its declared dependencies,
// which transitively include GatewayApiClient.Default
```

### 5. RateLimitExceededError Sleep Is Inside tapError

The sleep happens _before_ the retry fires. The `tapError` runs the sleep as a side-effect on error, then `Effect.retry` re-executes the whole `tryPromise`. This means the retry is unbounded — it will keep retrying as long as it gets 429s.

### 6. Legacy Error Classes vs TaggedError

Three errors (`InvalidStateInputError`, `InvalidComponentStateError`, `InvalidInputError`) use plain class patterns instead of `Data.TaggedError`. They still have `_tag` fields but lack the Effect interop of proper `TaggedError` (no `.pipe()`, no pattern matching with `Effect.catchTag`). Use `Effect.catchAll` or check `_tag` manually for these.

### 7. GetAddressByNonFungible Walks Back State Versions

When an NFT is burned, `GetAddressByNonFungibleService` decrements the state version and re-queries to find the last holder. This is a linear scan backwards and could be slow for long-burned NFTs.

### 8. BigNumber for Fungible Amounts

`GetFungibleBalance` returns amounts as `BigNumber` (from `bignumber.js`), not native `number` or `string`. This preserves Radix decimal precision but means you need BigNumber arithmetic downstream.
