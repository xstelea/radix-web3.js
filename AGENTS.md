# Context Reference Index

Deep-analysis reference docs for AI agents building on Radix + Effect + TanStack. **23 files, ~15,740 lines total.** Load selectively — use the routing table below to pick only what your current task needs.

---

## What to Load

Task-oriented reading lists. Numbers indicate suggested loading order (dependencies first).

### Building a Radix dApp (TypeScript)

1. [effect-Context](./context/effect-Context.md) — DI fundamentals (`Context.Tag`, `R` parameter)
2. [effect-Layer](./context/effect-Layer.md) — service composition
3. [effect-Schema](./context/effect-Schema.md) — runtime validation
4. [radix-radix-dapp-toolkit](./context/radix-radix-dapp-toolkit.md) — wallet connection + signing
5. [radix-TransactionManifest](./context/radix-TransactionManifest.md) — building manifests
6. [radix-TypescriptRadixEngineToolkit](./context/radix-TypescriptRadixEngineToolkit.md) — offline address derivation, SBOR encoding, tx building (TS/WASM)
7. [radix-TxTool](./context/radix-TxTool.md) — Effect transaction builder (sign, submit, poll)
8. [radix-Gateway](./context/radix-Gateway.md) — querying ledger state
9. [tanstackStart-ConsultationDapp](./context/tanstackStart-ConsultationDapp.md) — full-stack reference app

### Authenticating wallet users (ROLA)

1. [radix-radix-dapp-toolkit](./context/radix-radix-dapp-toolkit.md) — wallet challenge flow
2. [radix-ROLA](./context/radix-ROLA.md) — server-side signature verification
3. [radix-Account](./context/radix-Account.md) — `owner_keys` metadata & virtual derivation
4. [radix-Gateway](./context/radix-Gateway.md) — fetching on-ledger public keys

### Working with transactions

1. [radix-Sbor](./context/radix-Sbor.md) — binary encoding (wire format for all values)
2. [radix-TransactionManifest](./context/radix-TransactionManifest.md) — instruction sets & ManifestBuilder
3. [radix-transactions](./context/radix-transactions.md) — building, signing, serializing (Rust)
4. [radix-RadixEngineToolkit](./context/radix-RadixEngineToolkit.md) — offline analysis, address derivation, classification (Rust)
5. [radix-TypescriptRadixEngineToolkit](./context/radix-TypescriptRadixEngineToolkit.md) — offline tx building, signing, address derivation (TS/WASM)
6. [radix-TxTool](./context/radix-TxTool.md) — Effect-TS lifecycle: build intent → sign → submit → poll
7. [radix-SubIntents](./context/radix-SubIntents.md) — composable partial transactions
8. [radix-AccessRule](./context/radix-AccessRule.md) — auth rules governing method access

### Understanding Scrypto / on-ledger primitives

1. [radix-Sbor](./context/radix-Sbor.md) — SBOR encoding & schema system
2. [radix-AccessRule](./context/radix-AccessRule.md) — access control hierarchy
3. [radix-Account](./context/radix-Account.md) — native Account blueprint (30 methods)
4. [radix-TransactionManifest](./context/radix-TransactionManifest.md) — manifest instruction set
5. [radix-RadixEngineToolkit](./context/radix-RadixEngineToolkit.md) — manifest classification, entity types, address utilities

### Querying the Radix Gateway API

- **TypeScript:** [radix-Gateway](./context/radix-Gateway.md) — Effect wrapper with retry, pagination, batching
- **Rust:** [radix-GatewayRustSdk](./context/radix-GatewayRustSdk.md) — typed async/blocking HTTP clients

### Effect-TS fundamentals

1. [effect-Pipe](./context/effect-Pipe.md) — `pipe()`, `.pipe()`, `flow`, `Effect.gen`
2. [effect-Context](./context/effect-Context.md) — `Context.Tag`, service containers, `R` type
3. [effect-Layer](./context/effect-Layer.md) — composable service blueprints
4. [effect-Schema](./context/effect-Schema.md) — runtime validation & transformation
5. [effect-Queue](./context/effect-Queue.md) — fiber-safe bounded queues
6. [effect-Platform](./context/effect-Platform.md) — HTTP, filesystem, terminal, workers

### Setting up an Effect RPC server

1. [effect-Schema](./context/effect-Schema.md) — schema definitions for procedures
2. [effect-Rpc](./context/effect-Rpc.md) — procedures, groups, middleware, streaming
3. [effect-Context](./context/effect-Context.md) — service dependencies for handlers
4. [effect-Layer](./context/effect-Layer.md) — wiring handler services
5. [effect-Platform](./context/effect-Platform.md) — HTTP server transport

---

## Complete File Catalog

Ordered by dependency (prerequisites listed first within each category).

### Effect (8 files · ~5,950 lines)

| File | Lines | Description | Key deps |
|------|------:|-------------|----------|
| [effect-Pipe](./context/effect-Pipe.md) | 517 | `pipe()`, `.pipe()`, `flow`, and when to use `Effect.gen` | — |
| [effect-Context](./context/effect-Context.md) | 380 | DI via `Context.Tag`, typed service containers, `R` type parameter | — |
| [effect-Layer](./context/effect-Layer.md) | 597 | Composable memoized service blueprints — constructors, composition algebra, MemoMap, scopes | Context |
| [effect-Schema](./context/effect-Schema.md) | 1,118 | Runtime validation & transformation — built-in schemas, combinators, encoding/decoding | — |
| [effect-Queue](./context/effect-Queue.md) | 683 | Fiber-safe async bounded queues — backpressure, dropping, sliding, shutdown semantics | — |
| [effect-Platform](./context/effect-Platform.md) | 1,171 | `@effect/platform` — HTTP client/server, filesystem, terminal, workers, sockets, KV store | Context, Layer |
| [effect-Rpc](./context/effect-Rpc.md) | 1,077 | `@effect/rpc` — type-safe transport-agnostic RPC: procedures, groups, middleware, streaming | Schema, Context, Layer |
| [effect-atom](./context/effect-atom.md) | 406 | `@effect-atom/atom` — reactive state bridging Effect and React: atoms, derived computations | Context |

### Radix (13 files · ~8,115 lines)

| File | Lines | Description | Key deps |
|------|------:|-------------|----------|
| [radix-Sbor](./context/radix-Sbor.md) | 806 | SBOR wire format, value kinds, schema system, derive macros, depth-limited traversal | — |
| [radix-AccessRule](./context/radix-AccessRule.md) | 436 | Access control — `AllowAll`/`DenyAll`/`Protected`, composite requirements, role assignment | SBOR |
| [radix-Account](./context/radix-Account.md) | 459 | Account native blueprint — state, 30 methods, deposit rules, owner badge, virtual derivation | AccessRule, SBOR |
| [radix-TransactionManifest](./context/radix-TransactionManifest.md) | 880 | Transaction manifest — V1/V2 instructions, ManifestBuilder, compiler pipeline, validation | SBOR |
| [radix-transactions](./context/radix-transactions.md) | 814 | `radix-transactions` Rust crate — building, signing, validating, serializing (V1/V2, Signer) | TransactionManifest, SBOR |
| [radix-RadixEngineToolkit](./context/radix-RadixEngineToolkit.md) | 785 | `radix-engine-toolkit` Rust crate — offline analysis, address derivation, SBOR, classification | transactions, SBOR |
| [radix-TypescriptRadixEngineToolkit](./context/radix-TypescriptRadixEngineToolkit.md) | 891 | `@radixdlt/radix-engine-toolkit` TS/WASM wrapper — offline tx building, signing, address derivation, SBOR | RadixEngineToolkit |
| [radix-SubIntents](./context/radix-SubIntents.md) | 567 | Subintents / pre-authorizations — composable partial transactions, multisig, governance | TransactionManifest |
| [radix-Gateway](./context/radix-Gateway.md) | 541 | `@radix-effects/gateway` — Effect wrapper with tagged errors, 429 retry, pagination, batching | — |
| [radix-TxTool](./context/radix-TxTool.md) | 329 | `@radix-effects/tx-tool` — Effect transaction builder: Signer, lifecycle hooks, manifest helpers | Gateway, TransactionManifest, Context, Layer, Schema |
| [radix-GatewayRustSdk](./context/radix-GatewayRustSdk.md) | 718 | `radix-client` Rust crate — typed async/blocking HTTP clients for Gateway and Core APIs | — |
| [radix-radix-dapp-toolkit](./context/radix-radix-dapp-toolkit.md) | 357 | `@radixdlt/radix-dapp-toolkit` — wallet connection, signing, dual transport, RxJS state | — |
| [radix-ROLA](./context/radix-ROLA.md) | 532 | ROLA — challenge-response auth verifying wallet identity via on-ledger `owner_keys` signatures | dapp-toolkit, Gateway, Account |

### TanStack / React (2 files · ~1,680 lines)

| File | Lines | Description | Key deps |
|------|------:|-------------|----------|
| [tanstack-Router](./context/tanstack-Router.md) | 1,237 | TanStack Router — type-safe routing, SSR, file-based routes, search params, code splitting | — |
| [tanstackStart-ConsultationDapp](./context/tanstackStart-ConsultationDapp.md) | 440 | Consultation dApp — React 19 + TanStack Start + Effect Atoms + Radix governance voting | Router, effect-atom, dapp-toolkit |

---

## Dependency Graph

```
Effect                              Radix                          TanStack
─────                               ─────                          ───────

Pipe ─────────────┐                 Sbor ──────────┬─────────┐
                  │                   │            │         │
Context ────┬─────┤          AccessRule ──┐  TxManifest ──┬──┤     Router
            │     │                │     │         │      │  │       │
          Layer   │          Account     │   transactions │  │       │
            │     │                      │         │      │  │       │
Schema ─────┼─────┤                      │   SubIntents   │  │  ConsultationDapp
   │        │     │                      │         │      │  │    │  │  │
  Rpc    Platform │               Gateway  EngineToolkit  │  │    │  │  │
                  │                  │    TsEngineToolkit  │  │    │  │  │
                  │                  │    GatewayRustSdk   │  │    │  │  │
                atom              TxTool ─────────────────┘  │    │  │  │
                  │                  │                         │    │  │  │
                  │              dapp-toolkit                  │    │  │  │
                  │                  │                         │    │  │  │
                  │                ROLA ───────────────────────┘    │  │  │
                  │                                                 │  │  │
                  └─────────────────────────────────────────────────┘──┘──┘
```

Arrows flow downward: a file depends on everything above it that connects to it.

---

## Cross-Cutting Notes

- **SBOR is pervasive.** Any file dealing with on-ledger data (AccessRule, Account, TransactionManifest, transactions) assumes SBOR encoding. Load `radix-Sbor` first if you encounter unfamiliar `ManifestSbor`, `ScryptoSbor`, or `#[derive(ManifestSbor)]` references.
- **Schema ↔ Gateway.** The Gateway Effect wrapper (`radix-Gateway`) uses `effect-Schema` for response validation. If modifying Gateway response handling, load both.
- **dapp-toolkit → ROLA pipeline.** ROLA depends on `dapp-toolkit` for the wallet challenge/response flow and `radix-Gateway` for fetching on-ledger `owner_keys`. The three form a pipeline: dapp-toolkit (client) → ROLA (server verification) → Gateway (ledger lookup).
- **TxTool → Gateway → Signer pipeline.** `radix-TxTool` orchestrates the full TypeScript transaction lifecycle: manifest → intent → sign → submit → poll. It depends on `radix-Gateway` for submission/status and uses `effect-Context`/`effect-Layer`/`effect-Schema` for its service architecture. The `Signer` tag is swappable (Vault for production, private key for tests).
- **V1 vs V2 transactions.** `radix-TransactionManifest` and `radix-transactions` both cover the V1→V2 evolution. SubIntents are V2-only. If working with V2, load all three.
- **Rust vs TS Engine Toolkit.** `radix-RadixEngineToolkit` is the native Rust crate for server/CLI use. `radix-TypescriptRadixEngineToolkit` is the `@radixdlt/radix-engine-toolkit` TS/WASM wrapper for browser/Node — same core compiled to WASM. Use Rust for native performance, TS for frontend or Node projects.
