# Consultation dApp - Architecture Reference

> Source: `.repos/consultation_v2/apps/consultation`

Radix DLT governance dApp. Users browse proposals/temperature checks, vote with connected wallet accounts, admins manage governance parameters.

## Tech Stack

| Layer      | Tech                                                                     |
| ---------- | ------------------------------------------------------------------------ |
| Framework  | React 19, Vite, TanStack Start                                           |
| Routing    | TanStack Router v1.132 (file-based)                                      |
| State      | Effect Atoms (`@effect-atom/atom-react`)                                 |
| Forms      | TanStack Form v1.28 + Effect Schema validation                           |
| UI         | Radix UI primitives + shadcn/ui + CVA                                    |
| Styling    | Tailwind CSS v4, dark/light theme                                        |
| Icons      | Lucide React                                                             |
| Blockchain | Radix dApp Toolkit v2.2.1                                                |
| Gateway    | `@radix-effects/gateway`                                                 |
| HTTP       | `@effect/platform` FetchHttpClient                                       |
| Toast      | Sonner                                                                   |
| Markdown   | react-markdown + remark-gfm + rehype-sanitize                            |
| Server     | Nitro (single endpoint: well-known radix JSON)                           |
| Test       | Vitest + Testing Library                                                 |
| Lint       | Biome (single quotes, 2-space indent, no trailing commas, no semicolons) |
| Drawer     | Vaul (mobile bottom sheet)                                               |

Workspace deps: `shared` package (governance logic, schemas, branded types, manifest builders), `database`, `@radix-effects/gateway`, `@radix-effects/shared`.

## Project Structure

```
src/
  atom/                  # Effect Atoms (state management)
    makeRuntimeAtom.ts     # Atom.context factory + global logger layer
    dappToolkitAtom.ts     # Wallet connection, accounts, current account
    proposalsAtom.ts       # Proposal CRUD + batch voting
    temperatureChecksAtom.ts # TC CRUD + creation + batch voting
    adminAtom.ts           # isAdmin check, promote TC, toggle hidden
    governanceParametersAtom.ts # Read/update governance config
    voteClient.ts          # HTTP client service for vote-collector API
    voteResultsAtom.ts     # Aggregated vote results (from vote-collector)
    accountVotesAtom.ts    # Per-account vote data (from vote-collector)
    withToast.ts           # Effect middleware: loading/success/error toasts
  components/
    Header.tsx             # Sticky nav, wallet connect, theme toggle, account selector
    providers/themeProvider.tsx # Dark/light theme via localStorage
    detail/                # Shared detail page components
      DetailPageLayout.tsx   # Responsive: 5+3 col grid (desktop) / tabs+drawer (mobile)
      DetailPageHeader.tsx   # Status badge, title, dates, author, links
      DetailPageDetails.tsx  # Short desc + full markdown
      VoteResultsSection.tsx # Bar charts per vote option
      AccountVotesSection.tsx # Table of individual account votes
      VotingSection.tsx      # Vote UI with edit capability
    ui/                    # shadcn/ui wrappers (Button, Card, Tabs, etc.)
  hooks/
    useCurrentAccount.ts   # Selected account via useSyncExternalStore
    useIsAdmin.ts          # Checks admin badge on current account
  lib/
    dappToolkit.ts         # RadixDappToolkit service + SendTransaction service
    envVars.ts             # Validated env vars via Effect Schema
    selectedAccount.ts     # Account selection pub/sub (Ref + listeners)
    utils.ts               # truncateAddress, formatting helpers
    voting.ts              # Voting constants
  routes/                  # TanStack Router file-based routing
    __root.tsx               # Root layout: RegistryProvider > Toaster > ThemeProvider > Header > Outlet > Footer
    -index/                  # / - Home: tabbed Proposals + Temperature Checks lists
    tc/$id/-$id/             # /tc/:id - TC detail + voting
    tc/new/--new/            # /tc/new - Create temperature check form
    proposal/$id/-$id/       # /proposal/:id - Proposal detail + voting
    about/-about/            # /about - Governance info page
    about/admin/-admin/      # /about/admin - Edit governance parameters
  custom-elements.d.ts     # Type declarations for <radix-connect-button> web component
server/
  api/well-known-radix-json.ts  # Nitro: serves dApp definition for Radix wallet discovery
```

## Architecture Patterns

### Effect Atoms — Dual Runtime Design

The app uses two runtime creation strategies sharing a common `MemoMap` for atom deduplication:

**Global runtime factory** (`makeRuntimeAtom.ts`):

```ts
// Atom.context creates a shared context with a common MemoMap
export const makeAtomRuntime = Atom.context({ memoMap: Atom.defaultMemoMap });

// Global logger layer added to ALL runtimes created from this factory
makeAtomRuntime.addGlobalLayer(
  Layer.provideMerge(
    Logger.pretty,
    Logger.minimumLogLevel(
      envVars.EFFECTIVE_ENV === "dev" ? LogLevel.Debug : LogLevel.Info
    )
  )
);
```

**Lightweight runtime** — `dappToolkitAtom.ts` uses `Atom.runtime(RadixDappToolkit.Live)` directly for wallet-only atoms that don't need the full governance stack.

**Full DI runtime** — Domain atoms (TC, proposals, admin, governance params) create runtimes with the complete Layer stack:

```ts
const runtime = makeAtomRuntime(
  Layer.mergeAll(GovernanceComponent.Default, SendTransaction.Default).pipe(
    Layer.provideMerge(RadixDappToolkit.Live),
    Layer.provideMerge(GatewayApiClientLayer),
    Layer.provide(GovernanceConfigLayer),
    Layer.provide(Layer.setConfigProvider(ConfigProvider.fromJson(envVars)))
  )
);
```

**VoteClient runtime** — Separate lightweight runtime with just HTTP client:

```ts
const voteClientRuntime = makeAtomRuntime(
  VoteClientLive.pipe(Layer.provide(FetchHttpClient.layer))
);
```

### Atom Types

**Read atoms** — `runtime.atom(Effect.gen(...))` for data fetching:

```ts
export const governanceParametersAtom = runtime.atom(
  Effect.gen(function* () {
    const governanceComponent = yield* GovernanceComponent;
    return yield* governanceComponent.getGovernanceParameters();
  })
);
```

**Parameterized atoms** — `Atom.family((param) => ...)` for pagination, by-ID lookups. Nested families for multi-param:

```ts
export const paginatedProposalsAtom = Atom.family((page: number) =>
  Atom.family((sortOrder: SortOrder) =>
    runtime.atom(Effect.gen(function* () { ... }))
  )
)
```

**Streaming atoms** — Use `Effect.fnUntraced` with `get` parameter for inter-atom deps and `get.setSelf` for push-based updates:

```ts
export const walletDataAtom = runtime.atom(
  Effect.fnUntraced(function* (get) {
    // Convert RxJS Observable → Effect Stream → push via setSelf
    const walletData = Stream.asyncScoped<WalletData>((emit) =>
      Effect.gen(function* () {
        const subscription = rdt.walletApi.walletData$.subscribe((data) =>
          emit.single(data)
        );
        return Effect.sync(() => subscription.unsubscribe());
      })
    );
    yield* Stream.runForEach(
      Stream.changesWith(walletData /* dedup by account addresses */),
      (value) => Effect.sync(() => get.setSelf(Effect.succeed(value)))
    );
    return rdt.walletApi.getWalletData(); // initial value
  })
);
```

**Action atoms** — `runtime.fn(Effect.fn(..., withToast({...})))` for mutations. Actions use `get.refresh(atom)` to invalidate dependent atoms after mutations:

```ts
export const voteOnTemperatureCheckBatchAtom = runtime.fn(
  Effect.fn(function* (input, get) {
    // ... sequential vote loop ...
    if (hasSuccessfulVotes) {
      get.refresh(getTemperatureCheckVotesByAccountsAtom(input.keyValueStoreAddress))
    }
    return results
  }, withToast({ ... }))
)
```

### Component Consumption Pattern

```ts
const result = useAtomValue(someAtom)
Result.builder(result)
  .onInitial(() => <Skeleton />)
  .onSuccess((data) => <Content data={data} />)
  .onFailure((error) => <Error />)
  .render()
```

### withToast Middleware

Higher-order Effect wrapper using Sonner. Wraps mutation atoms with loading/success/error toasts:

- `whenLoading` — string or `(args) => ReactNode` shown immediately
- `whenSuccess` — string or `(result, args) => ReactNode` shown on completion
- `whenFailure` — returns `Option<string>` — `Option.none()` = dismiss silently (e.g. user cancelled wallet)

Failure handling pattern — match on `cause._tag === 'Fail'` then check error class:

```ts
whenFailure: ({ cause }) => {
  if (cause._tag === "Fail") {
    if (cause.error instanceof WalletErrorResponse)
      return Option.some(cause.error.message ?? "Wallet error");
    if (cause.error instanceof NoAccountConnectedError)
      return Option.some(cause.error.message);
  }
  return Option.some("Failed");
};
```

### Error Types

All errors use `Data.TaggedError`:

- `WalletErrorResponse` — wallet signing failures (may contain `transactionIntentHash`, `status`)
- `UnexpectedWalletError` — unexpected promise rejection from wallet API
- `NoAccountConnectedError` — no wallet connected
- `AccountAlreadyVotedError` — vote already cast (catchable for revoting)
- `EventNotFoundError` — SBOR event not in transaction receipt
- `BrowserNotAvailableError` — SSR guard (window undefined)
- `VoteClientError` — vote-collector API failures

### ClientOnly SSR Pattern

All route components using wallet state are wrapped in `ClientOnly` from TanStack Router to prevent SSR hydration issues with the Radix web component:

```ts
function RouteComponent() {
  return <ClientOnly><ActualComponent /></ClientOnly>
}
```

## Radix Integration

### Wallet Connection

`RadixDappToolkit` is an Effect `Context.Tag` wrapping `Ref<RadixDappToolkitFactory>`:

- Created in `Layer.scoped` with finalizer (`rdt.destroy()`)
- Guards against SSR: yields `BrowserNotAvailableError` if `typeof window === 'undefined'`
- Requests at least 1 account: `DataRequestBuilder.accounts().atLeast(1)`
- Wallet data streamed reactively via `rdt.walletApi.walletData$` Observable → Effect Stream with change detection
- Rendered via `<radix-connect-button>` custom element (typed in `custom-elements.d.ts`)

### Account Selection

Module-level pub/sub in `selectedAccount.ts`:

- `Ref.unsafeMake<Option<string>>` stores selected address (Effect Ref, outside React)
- `Set<() => void>` listeners for `useSyncExternalStore` compatibility
- `setSelectedAccountAddress(addr)` — imperative setter (called from `AccountSelector` component)
- `getCurrentAccount` — Effect that reads Ref + wallet data, defaults to first account
- `useCurrentAccount()` hook — bridges atom state (`accountsAtom`) with `useSyncExternalStore` for reactive tracking

### Transaction Flow

`SendTransaction` is an `Effect.Service` wrapping `rdt.walletApi.sendTransaction()`:

1. Atom action builds manifest via `GovernanceComponent.make*Manifest()`
2. `SendTransaction(manifest, message)` sends to Radix Wallet
3. On success: returns `{ transactionIntentHash }`
4. On wallet error: yields `WalletErrorResponse` tagged error
5. For TC creation: polls Gateway API for committed transaction, parses SBOR event (`TemperatureCheckCreatedEvent`)

### Admin Badge Check

`isAdminAtom(accountAddress)` — `Atom.family` that:

1. Uses `GetFungibleBalance` service to fetch account's fungible resources
2. Checks if any resource matches `GovernanceConfig.adminBadgeAddress`
3. Returns boolean — components individually guard themselves (no route-level guard)

### Admin Operations

All require admin badge proof (built into manifest):

- `promoteToProposalAtom(temperatureCheckId)` — promotes TC to governance proposal
- `toggleTemperatureCheckHiddenAtom(id)` — hide/unhide TC
- `toggleProposalHiddenAtom(id)` — hide/unhide proposal
- `updateGovernanceParametersAtom(params)` — update on-chain governance config

### Network Configuration

- Network ID 1 = Mainnet, 2 = Stokenet
- `GovernanceConfig` layer selects deployed component/package addresses based on network
- Stokenet component: `component_tdx_2_1cqnp3rpt...`
- Mainnet: TODO (not yet deployed)
- `server/api/well-known-radix-json.ts` — Nitro endpoint serving `/.well-known/radix.json` with `dAppDefinitionAddress`

## Data Sources

### On-Chain (via GovernanceComponent)

Accessed via `@radix-effects/gateway` services:

- Component state (TC count, proposal count, KV store addresses, governance parameters)
- KV store data (individual TCs, proposals, per-account votes)
- Account resource balances (for admin badge check)
- SBOR decoding via `sbor-ez-mode` + schemas in `packages/shared`

### Vote Collector API (via VoteClient)

Separate backend microservice. `VoteClient` is an Effect `Context.Tag` with two methods:

- `GetVoteResults({ type, entityId })` — aggregated vote tallies per option
- `GetAccountVotes({ type, entityId })` — individual account votes with voting power

Backed by `@effect/platform` `HttpClient`, responses validated with Effect Schema. Base URL from `VITE_VOTE_COLLECTOR_URL`.

## Routes & Pages

| Route           | Description                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| `/`             | Home - tabs: Proposals list + TC list. Paginated (5/page), sortable, status badges                           |
| `/tc/:id`       | TC detail: header, markdown body, vote results, account votes, voting UI. Admin: hide toggle, promote button |
| `/tc/new`       | Create TC form: title, descriptions, RadixTalk URL, links, vote options, max selections                      |
| `/proposal/:id` | Proposal detail: same layout as TC but with multi-option voting                                              |
| `/about`        | Governance info: TC vs GP parameter comparison, voting power explanation                                     |
| `/about/admin`  | Admin: edit governance parameters (voting period, quorum, approval threshold for TC and GP)                  |

### Component Hierarchy

```
RootDocument (html shell)
└── RootComponent
    ├── RegistryProvider (effect-atom global context)
    ├── Toaster (sonner)
    └── ThemeProvider
        ├── Header
        │   ├── DropdownMenu (mobile nav)
        │   ├── Nav links (Home, New Proposal, About)
        │   ├── AccountSelector (multi-account select when >1 account)
        │   └── ConnectButton (<radix-connect-button> web component)
        └── <Outlet> (route content)

Home Page (/)
├── Tabs (Proposals / Temperature Checks)
├── SortToggle
├── ProposalsList (paginated, reads paginatedProposalsAtom)
└── TemperatureChecksList (paginated, reads paginatedTemperatureChecksAtom)
    └── ItemCard
        ├── StatusBadge, EndingSoonBadge
        ├── AddressLink (author)
        └── QuorumProgress (reads voteResultsAtom)

Detail Pages (/tc/$id, /proposal/$id)
└── DetailPageLayout
    ├── DetailPageHeader (StatusBadge, QuorumBadge, PromoteToProposal/OriginBadge, HideToggle)
    ├── DetailPageDetails (markdown rendering)
    ├── [Desktop] SidebarContent (sticky)
    │   ├── VoteResultsSection (bar charts)
    │   ├── VotingSection (vote UI)
    │   └── AccountVotesSection (per-account table)
    └── [Mobile] Vaul Drawer with VotingSection

TC Create (/tc/new)
└── TemperatureCheckForm (TanStack Form + Effect Schema validator)
    ├── title, shortDescription, radixTalkUrl fields
    ├── MarkdownUploadField (.md file upload for description)
    ├── LinksField (dynamic URL list)
    ├── VoteOptionsField (dynamic with add/remove)
    └── MaxSelectionsField (single vs multi-select toggle)
```

## Voting

### Temperature Checks

- Binary: "For" / "Against"
- Revoting allowed (accounts can change vote)
- Batch voting: all connected accounts vote sequentially (not parallel)

### Governance Proposals

- Multi-option voting (custom options per proposal)
- `maxSelections` controls single vs multi-select
- Same batch/revote support as TCs

### Batch Vote Flow

1. Loop through accounts sequentially
2. Each: build manifest -> `SendTransaction` -> capture per-account result
3. Collect `VoteResult[]` with `{ account, success, error? }`
4. On any success: `get.refresh()` on votes atom to invalidate and refetch UI
5. Toast: "N submitted, M failed"

## Environment Variables

```
VITE_ENV                              # dev | staging | prod | local
VITE_PUBLIC_DAPP_DEFINITION_ADDRESS   # Radix account address
VITE_PUBLIC_NETWORK_ID                # 1 (mainnet) | 2 (stokenet)
VITE_VOTE_COLLECTOR_URL               # Vote collector API base URL
```

Validated at startup via Effect `Schema.Class`. `local` env maps to `dev` for `EFFECTIVE_ENV`. Vitest gets hardcoded mock env vars. Invalid vars throw with `TreeFormatter.formatErrorSync`.

## Shared Governance Layer

The `shared` workspace package provides:

- **GovernanceComponent** — Effect service: read proposals/TCs, build transaction manifests, paginated queries
- **GovernanceConfig** — Effect service: component address, admin badge address, package address (network-dependent)
- **Branded types** — `ProposalId`, `TemperatureCheckId`, `EntityId`, `EntityType`, `KeyValueStoreAddress`, `AccountAddress`
- **Schemas** — `MakeTemperatureCheckInput`, `MakeProposalVoteInput`, `GovernanceParameters`, etc.
- **SBOR parsing** — `parseSbor()` + `TemperatureCheckCreatedEvent` for on-chain event data
- **GatewayApiClientLayer** — configured Gateway API client layer

### Key Domain Types

```ts
TemperatureCheck = {
  id, title, shortDescription, description,
  voters: KeyValueStoreAddress,     // KV store: address → vote
  votes: KeyValueStoreAddress,      // KV store: voteId → record
  voteCount, revoteCount,
  voteOptions: Array<{ id, label }>,
  links: string[], quorum: string,  // decimal XRD amount
  start: Date, deadline: Date,
  elevatedProposalId: Option<ProposalId>,
  author: AccountAddress, hidden: boolean
}

Proposal = {
  ...similar to TC, plus:
  maxSelections: number,            // 1 = single choice, >1 = multi
  temperatureCheckId: TemperatureCheckId
}

GovernanceParameters = {
  temperature_check_days, temperature_check_quorum, temperature_check_approval_threshold,
  proposal_length_days, proposal_quorum, proposal_approval_threshold
}
```
