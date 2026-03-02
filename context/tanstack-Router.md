# TanStack Router - Deep Source Analysis

## Overview

TanStack Router is a **fully type-safe**, **client-side** router with first-class support for SSR, streaming, file-based routing, search param validation, and data loading. The codebase is a monorepo of ~38 packages. Core routing logic lives in `router-core` (framework-agnostic), with framework adapters (`react-router`, `solid-router`, `vue-router`) and a full-stack layer (`start-*`).

Key packages:

- `router-core` — RouterCore class, route definition, matching, state, history, search params, SSR
- `react-router` — React bindings (hooks, Link, error boundaries, useBlocker)
- `router-generator` — file-based route tree codegen
- `router-plugin` — Vite/Webpack plugin for code splitting
- `virtual-file-routes` — programmatic route definition API
- `history` — browser/hash/memory history abstraction
- `start-client-core` / `start-server-core` — full-stack middleware + server functions
- Validator adapters: `zod-adapter`, `valibot-adapter`, `arktype-adapter`

---

## Core Architecture

### RouterCore Class

```ts
class RouterCore<
  in out TRouteTree extends AnyRoute,
  in out TTrailingSlashOption extends TrailingSlashOption,
  in out TDefaultStructuralSharingOption extends boolean,
  in out TRouterHistory extends RouterHistory = RouterHistory,
  in out TDehydrated extends Record<string, any> = Record<string, any>,
>
```

Created via `createRouter(options)` (constructor is deprecated). Uses `in out` variance annotations on all type params for strict invariance.

### RouterOptions (key fields)

```ts
{
  routeTree?: TRouteTree
  history?: TRouterHistory           // default: createBrowserHistory()
  basepath?: string                  // default: '/'
  context?: InferRouterContext<TRouteTree>
  caseSensitive?: boolean            // default: false
  trailingSlash?: 'always' | 'never' | 'preserve'  // default: 'never'
  notFoundMode?: 'root' | 'fuzzy'   // default: 'fuzzy'
  defaultPreload?: false | 'intent' | 'viewport' | 'render'
  defaultPreloadDelay?: number       // default: 50ms
  defaultPendingMs?: number          // default: 1000ms
  defaultPendingMinMs?: number       // default: 500ms
  defaultStaleTime?: number          // default: 0
  defaultPreloadStaleTime?: number   // default: 30_000ms
  defaultGcTime?: number             // default: 1_800_000ms (30min)
  defaultPreloadGcTime?: number      // default: 1_800_000ms
  stringifySearch?: SearchSerializer
  parseSearch?: SearchParser
  search?: { strict?: boolean }
  defaultStructuralSharing?: boolean
  defaultViewTransition?: boolean | ViewTransitionOptions
  scrollRestoration?: boolean | ((opts: { location }) => boolean)
  dehydrate?: () => TDehydrated
  hydrate?: (dehydrated: TDehydrated) => Awaitable<void>
  routeMasks?: Array<RouteMask<TRouteTree>>
  pathParamsAllowedCharacters?: Array<';' | ':' | '@' | '&' | '=' | '+' | '$' | ','>
  rewrite?: LocationRewrite          // { input?, output? } for basepath/subdomain rewrites
}
```

### RouterState

Uses `@tanstack/store` `Store<RouterState>` on client, synchronous `createServerStore` on server. State accessed via `router.state` getter.

```ts
interface RouterState<TRouteTree extends AnyRoute = AnyRoute> {
  status: "pending" | "idle";
  loadedAt: number;
  isLoading: boolean;
  isTransitioning: boolean;
  matches: Array<RouteMatch>; // currently active committed matches
  pendingMatches?: Array<RouteMatch>; // matches being loaded for next location
  cachedMatches: Array<RouteMatch>; // recently exited matches kept for gcTime
  location: ParsedLocation<FullSearchSchema<TRouteTree>>;
  resolvedLocation?: ParsedLocation; // last successfully loaded location
  statusCode: number;
  redirect?: AnyRedirect;
}
```

### RouteMatch shape

```ts
interface RouteMatch {
  id: string; // routeId + interpolatedPath + loaderDepsHash
  routeId: string;
  fullPath: string;
  index: number;
  pathname: string; // interpolated (params substituted)
  params: Record<string, string>;
  status: "pending" | "success" | "error" | "redirected" | "notFound";
  isFetching: false | "beforeLoad" | "loader";
  error: unknown;
  loaderData?: unknown;
  context: Record<string, unknown>; // merged routerContext + routeContext + beforeLoadContext
  search: Record<string, unknown>;
  loaderDeps: Record<string, unknown>;
  cause: "preload" | "enter" | "stay";
  preload: boolean;
  invalid: boolean;
  fetchCount: number;
  abortController: AbortController;
  meta?: Array<RouterManagedTag>; // from head()
  links?: Array<RouterManagedTag>;
  headScripts?: Array<RouterManagedTag>;
  staticData: StaticDataRouteOption;
}
```

### RouterEvents

```ts
interface RouterEvents {
  onBeforeNavigate: NavigationEventInfo;
  onBeforeLoad: NavigationEventInfo;
  onLoad: NavigationEventInfo;
  onResolved: NavigationEventInfo;
  onBeforeRouteMount: NavigationEventInfo;
  onRendered: NavigationEventInfo;
}
// NavigationEventInfo = { fromLocation?, toLocation, pathChanged, hrefChanged, hashChanged }
```

Subscribe: `router.subscribe('onResolved', fn)` → returns unsubscribe.

### Loading Lifecycle

1. `commitLocation()` → pushes/replaces history entry
2. `load()` → calls `beforeLoad()` which runs `matchRoutes()`, stores `pendingMatches`
3. Emits `onBeforeNavigate`, `onBeforeLoad`
4. `loadMatches({ matches: pendingMatches })` runs beforeLoad → loader lifecycle
5. `onReady` callback: commits `pendingMatches → matches`, moves exiting matches to `cachedMatches`, fires `onLeave/onEnter/onStay` hooks
6. Redirect handling: `navigate({ replace: true, ignoreBlocker: true, ...redirect.options })`

### matchRoutes(pathname, locationSearch?)

1. `getMatchedRoutes(pathname)` — trie-based route matching
2. For each matched route **serially** (child depends on parent's search):
   - Runs `validateSearch(route.options.validateSearch, parentSearch)` → `preMatchSearch`
   - Runs `loaderDeps({ search })` → computes `loaderDepsHash`
   - Builds `matchId = route.id + interpolatedPath + loaderDepsHash`
   - Reuses `existingMatch` from state if available, else creates new match
   - Calls synchronous `route.options.context(ctx)` → `__routeContext`
3. Returns array of matches

---

## Type System

### Register Pattern (Module Augmentation)

The central mechanism for global type inference:

```ts
// Declared in router-core:
export interface Register {
  // router: typeof myRouter
}

// User augments in their app:
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

`RegisteredRouter` resolves to the user's concrete router type, enabling all hooks (`useParams`, `useSearch`, `useLoaderData`, etc.) to infer route-specific types without explicit type parameters.

### ParseRoute — Tree Flattening

Recursively flattens the route tree into a union of all route types:

```ts
type ParseRoute<TRouteTree, TAcc = TRouteTree> = TRouteTree extends {
  types: { children: infer TChildren };
}
  ? unknown extends TChildren
    ? TAcc
    : TChildren extends ReadonlyArray<any>
      ? ParseRoute<TChildren[number], TAcc | TChildren[number]>
      : ParseRoute<
          TChildren[keyof TChildren],
          TAcc | TChildren[keyof TChildren]
        >
  : TAcc;
```

### RoutesById / RoutesByPath

```ts
type CodeRoutesById<TRouteTree> = {
  [K in ParseRoute<TRouteTree> as K["id"]]: K;
};
type RoutesByPath<TRouteTree> = {
  [K in ParseRoute<TRouteTree> as K["fullPath"]]: K;
};
```

For file-based routes, these resolve from `InferFileRouteTypes<TRouteTree>` → `fileRoutesById` / `fileRoutesByFullPath` written by codegen.

### ParsePathParams

```ts
// '/blog/$postId/comments/$commentId' → { required: 'postId' | 'commentId', optional: never }
// '/files/$...path' (splat)           → { required: never, optional: 'path' }
type ParsePathParams<TPath extends string> = ...
```

Syntax: `$paramName` (required), `$paramName?` (optional), `$...name` (splat/catch-all).

### RouteTypes (phantom property)

Each route carries a `types` phantom property encoding the full type tree:

```ts
interface RouteTypes<...> {
  parentRoute: TParentRoute
  path: TPath
  to: TrimPathRight<TFullPath>
  fullPath: TFullPath
  id: TId
  searchSchema: ResolveValidatorOutput<TSearchValidator>
  fullSearchSchema: ResolveFullSearchSchema<TParentRoute, TSearchValidator>
  params: TParams
  allParams: ResolveAllParamsFromParent<TParentRoute, TParams>
  routeContext: ResolveRouteContext<TRouteContextFn, TBeforeLoadFn>
  allContext: ResolveAllContext<TParentRoute, TRouterContext, TRouteContextFn, TBeforeLoadFn>
  loaderData: ResolveLoaderData<TLoaderFn>
  loaderDeps: TLoaderDeps
  children: TChildren
  fileRouteTypes: TFileRouteTypes
}
```

### FileRouteTypes (codegen interface)

Written by the generator onto the root route's `types.fileRouteTypes`:

```ts
interface FileRouteTypes {
  fileRoutesByFullPath: Record<string, Route>;
  fullPaths: string; // union
  to: string; // navigable "to" paths
  fileRoutesByTo: Record<string, Route>;
  id: string; // union of all IDs
  fileRoutesById: Record<string, Route>;
}
```

### Variance Annotations

All `RouterCore` type params use `in out` for strict invariance — prevents widening/narrowing that would break type safety at router boundaries.

---

## Route Definition

### BaseRoute Class

```ts
class BaseRoute<TRegister, TParentRoute, TPath, TFullPath, TCustomId, TId,
  TSearchValidator, TParams, TRouterContext, TRouteContextFn, TBeforeLoadFn,
  TLoaderDeps, TLoaderFn, TChildren, TFileRouteTypes, TSSR, TServerMiddlewares, THandlers>
```

Created via `createRoute(options)` or `createRootRoute(options)`.

### RouteOptions

Composed of `BaseRouteOptions & UpdatableRouteOptions`:

**Core lifecycle options:**

```ts
{
  validateSearch?: SearchValidator      // search param validation
  context?: (ctx) => any               // synchronous context derivation
  beforeLoad?: (ctx) => any            // async, serial — auth guards, context extension
  loader?: (ctx) => any                // async — data fetching
  loaderDeps?: (opts: { search }) => TLoaderDeps  // cache key from search
  shouldReload?: boolean | ((match) => any)
  ssr?: SSROption | ((ctx) => Awaitable<SSROption>)
}
```

**Component + behavior options:**

```ts
{
  component?: unknown
  errorComponent?: unknown
  pendingComponent?: unknown
  notFoundComponent?: unknown

  pendingMs?: number
  pendingMinMs?: number
  staleTime?: number
  gcTime?: number
  preloadStaleTime?: number
  preloadGcTime?: number

  search?: { middlewares?: Array<SearchMiddleware> }

  onEnter?: (match) => void
  onStay?: (match) => void
  onLeave?: (match) => void
  onCatch?: (error: Error) => void

  head?: (ctx) => Awaitable<{ links?, scripts?, meta?, styles? }>
  headers?: (ctx) => Awaitable<Record<string, string>>

  params?: { parse?: ParseParamsFn, stringify?: StringifyParamsFn }
  caseSensitive?: boolean
  codeSplitGroupings?: Array<Array<'loader' | 'component' | 'pendingComponent' | ...>>
}
```

### Route ID Computation

During `init()`:

```ts
const id = joinPaths([
  parentRoute.id === rootRouteId ? "" : parentRoute.id,
  customId,
]);
const fullPath =
  id === rootRouteId ? "/" : joinPaths([parentRoute.fullPath, path]);
this._to = trimPathRight(fullPath); // removes trailing slash
```

### Code-Based vs File-Based

**Code-based:**

```ts
const rootRoute = createRootRoute({ component: RootComponent })
const blogRoute = createRoute({ getParentRoute: () => rootRoute, path: 'blog' })
const postRoute = createRoute({ getParentRoute: () => blogRoute, path: '$postId', loader: ... })
const routeTree = rootRoute.addChildren([blogRoute.addChildren([postRoute])])
```

**File-based:** Routes defined as files in `src/routes/`, generator writes `routeTree.gen.ts` with `createFileRoute(path)(options)` calls wired together.

---

## Search Params

### SearchSchemaInput Marker Type

```ts
type SearchSchemaInput = { __TSearchSchemaInput__: "TSearchSchemaInput" };
```

When `validateSearch` accepts a param typed with `SearchSchemaInput`, the input type becomes the "input schema" (for `<Link search={...}>` type-checking), separate from the output/validated type.

### 4 Validator Shapes

```ts
type SearchValidator<TInput, TOutput> =
  | ValidatorFn<TInput, TOutput> // (input) => output
  | ValidatorObj<TInput, TOutput> // { parse: (input) => output }
  | ValidatorAdapter<TInput, TOutput> // { types: { input, output }, parse: (input) => output }
  | StandardSchemaValidator<TInput, TOutput>; // { '~standard': { validate, types? } }
```

**Shape 1 — Plain function:**

```ts
validateSearch: (search) => ({ page: Number(search.page) || 1 });
```

**Shape 2 — Object with parse (Zod v3, etc.):**

```ts
validateSearch: z.object({ page: z.number() }); // has .parse()
```

**Shape 3 — ValidatorAdapter (library adapters):**

```ts
validateSearch: { types: { input: ..., output: ... }, parse: (input) => output }
```

**Shape 4 — Standard Schema (Valibot, ArkType, Zod v4 via `~standard`):**

```ts
validateSearch: v.object({ page: v.number() });
```

Runtime dispatch checks in order: `'~standard' in v` → `'parse' in v` → `typeof v === 'function'`.

### Search Inheritance

During `matchRoutesInternal`, each route's validated search is **merged on top of parent's**:

```ts
const strictSearch = validateSearch(route.options.validateSearch, {
  ...parentSearch,
});
preMatchSearch = { ...parentSearch, ...strictSearch };
```

Type: `fullSearchSchema = IntersectAssign<parentFullSearchSchema, thisRouteSchema>`.

### Search Middleware

```ts
type SearchMiddlewareContext<TSearchSchema> = {
  search: TSearchSchema;
  next: (newSearch: TSearchSchema) => TSearchSchema;
};
type SearchMiddleware<TSearchSchema> = (
  ctx: SearchMiddlewareContext<TSearchSchema>
) => TSearchSchema;
```

Declared: `search: { middlewares: [...] }` on route options.

Chain built during `buildLocation` / `applySearchMiddleware`:

1. All middlewares from root to leaf concatenated
2. Final "terminal" middleware applies the navigation's `dest.search` transform
3. Standard middleware pipeline: `middleware({ search, next })`

**Built-in helpers** (`searchMiddleware.ts`):

```ts
retainSearchParams(keys | true); // carry specified keys forward across navigations
stripSearchParams(defaults | keys | true); // remove optional/default-valued keys
```

### Serialization

```ts
const defaultParseSearch = parseSearchWith(JSON.parse);
const defaultStringifySearch = stringifySearchWith(JSON.stringify, JSON.parse);
```

Uses `qss.decode()` for query string parsing, then attempts `JSON.parse` on each string value. Customizable via `stringifySearch` / `parseSearch` router options.

---

## Data Loading

### Context Flow: context() → beforeLoad() → loader()

```
router.options.context              (global root context)
   ↓ merged
route.options.context()             → match.__routeContext  (sync, during matchRoutes)
   ↓ merged
route.options.beforeLoad()          → match.__beforeLoadContext  (async, serial per route)
   ↓ all merged into
match.context = { ...parentContext, ...__routeContext, ...__beforeLoadContext }
   ↓ available in
route.options.loader(ctx)           ctx.context = full merged context
```

Each level receives parent's merged context. Types tracked via:

```ts
type ResolveAllContext<
  TParentRoute,
  TRouterContext,
  TRouteContextFn,
  TBeforeLoadFn,
> = Assign<
  BeforeLoadContextParameter<TParentRoute, TRouterContext, TRouteContextFn>,
  ContextAsyncReturnType<TBeforeLoadFn>
>;
```

### beforeLoad (async, serial)

```ts
interface BeforeLoadContextOptions {
  context: Expand<BeforeLoadContextParameter<...>>  // parent + routeContext merged
  params: ...
  search: ...
  // Can throw redirect() or notFound()
  // Return object to extend context for downstream
}
```

Runs **serially** — each route's `beforeLoad` awaits parent's. Used for auth guards, context extension.

### loader (async, parallel-capable)

```ts
interface LoaderFnContext {
  abortController: AbortController
  preload: boolean
  params: Expand<ResolveAllParamsFromParent<...>>
  deps: TLoaderDeps
  context: Expand<ResolveAllContext<...>>  // router + context() + beforeLoad() merged
  location: ParsedLocation                // intentionally no typed search (use loaderDeps)
  parentMatchPromise: Promise<MakeRouteMatchFromRoute<TParentRoute>>
  cause: 'preload' | 'enter' | 'stay'
  route: AnyRoute
}
```

Return value becomes `match.loaderData`.

### loaderDeps — Cache Key Computation

```ts
loaderDeps?: (opts: { search: FullSearchSchema }) => TLoaderDeps
```

Return value is `JSON.stringify()`-ed into `loaderDepsHash` → part of `matchId`. This is the **only** sanctioned way to make the loader re-run on search param changes. Loader intentionally does NOT see typed `search` to discourage bypassing deps.

### Caching: staleTime / gcTime

- `matchId = route.id + interpolatedPath + loaderDepsHash`
- Existing match with same `matchId` is reused unless `invalid: true`
- `staleTime` (default 0): data considered stale after this many ms → re-fetches on navigation
- `gcTime` (default 30min): exiting matches stay in `cachedMatches` before GC
- `preloadStaleTime` (default 30s) / `preloadGcTime` (default 30min): separate for preloads
- Uses `replaceEqualDeep` structural sharing for reference identity stability

`clearExpiredCache()` runs after each `load()`:

```ts
const gcTime = match.preload
  ? (route.options.preloadGcTime ?? router.options.defaultPreloadGcTime)
  : (route.options.gcTime ?? router.options.defaultGcTime ?? 5 * 60 * 1000);
const gcEligible = Date.now() - match.updatedAt >= gcTime;
```

### defer() for Streaming

```ts
const TSR_DEFERRED_PROMISE = Symbol.for("TSR_DEFERRED_PROMISE");

type DeferredPromise<T> = Promise<T> & {
  [TSR_DEFERRED_PROMISE]: {
    status: "pending" | "resolved" | "rejected";
    data?;
    error?;
  };
};

function defer<T>(
  promise: Promise<T>,
  options?: { serializeError? }
): DeferredPromise<T>;
```

Usage:

```ts
loader: async () => {
  const critical = await fetchCritical();
  const streamed = defer(fetchSlow()); // NOT awaited
  return { critical, streamed };
};
```

Client uses `<Await>` component (calls `useAwaited`) to suspend on the deferred promise.

### loadMatches Execution Order

1. For each match in order: `handleBeforeLoad(index)` — serial, awaited per match
2. After all beforeLoads: `runLoader(matchId, index)` — can run in parallel
3. `executeHead(matchId)` runs `head()` / `scripts()` / `headers()` after loader
4. `onReady()` fires after `pendingMs` timeout OR when first loader resolves → pending component renders

---

## Navigation

### buildLocation(opts) → ParsedLocation

The core location-building utility (used by navigate, Link, preloading):

1. Resolves current location from `pendingBuiltLocation || latestLocation`
2. `matchRoutesLightweight` to get current `fullPath`, `search`, `params`
3. Resolves `from` path → `nextTo` via `resolvePathWithBase`
4. Merges/updates `nextParams`
5. `getMatchedRoutes(nextTo)` to resolve destination routes
6. Runs `params.stringify` on each route
7. `applySearchMiddleware({ search, dest, destRoutes })` — runs middleware chain
8. Stringifies search, hash, state
9. Returns `ParsedLocation` (with optional `maskedLocation` if route masks apply)

### navigate(opts)

If `reloadDocument` or absolute `href` → `window.location.href`. Otherwise calls `buildAndCommitLocation(opts)`.

### commitLocation({ replace?, viewTransition?, ignoreBlocker? })

1. If URL + state identical → calls `load()` directly (no history push)
2. Handles `maskedLocation`: stores real location in `state.__tempLocation`
3. Calls `history.push/replace(publicHref, state)`
4. If no history subscribers → calls `load()` directly

### preloadRoute(opts) → Promise<Array<RouteMatch> | undefined>

1. `buildLocation(opts)` → location
2. `matchRoutes(next, { preload: true })`
3. Adds unmatched to `cachedMatches`
4. `loadMatches({ preload: true })` without triggering navigation
5. Follows redirects recursively

### invalidate(opts?)

Marks matches as `{ invalid: true }` (with optional filter). If `forcePending` or error/notFound, resets to `{ status: 'pending' }`. Then calls `load()`.

### Link Component (react-router)

```ts
type LinkProps = ActiveLinkOptions & LinkPropsChildren;
// children: ReactNode | ((state: { isActive, isTransitioning }) => ReactNode)
```

**Key props:**

- `to` — destination route path (type-safe)
- `from` — base for relative navigation
- `params`, `search`, `hash`, `state` — all type-safe per route
- `replace` — use history.replace
- `resetScroll` — reset scroll on navigation
- `viewTransition` — enable view transitions
- `startTransition` — wrap in React `startTransition`
- `preload` — `false | 'intent' | 'render' | 'viewport'`
- `preloadDelay` — ms before preloading on hover/focus (default from router)
- `activeOptions` — `{ exact?, includeSearch?, includeHash?, explicitUndefined? }`
- `activeProps` / `inactiveProps` — applied based on active state
- `mask` — location masking config

**Preloading strategies:**

- `'intent'` — preloads on `mouseEnter` / `focus`; uses `preloadDelay` timeout, cancels on leave
- `'render'` — preloads immediately via `useEffect` on mount (once via `hasRenderFetched` ref)
- `'viewport'` — uses `IntersectionObserver` (100px rootMargin) to preload when visible

**Active state detection:**

- Exact: `exactPathTest(current, next, basepath)`
- Fuzzy: `current.startsWith(next) && ('/' follows OR same length)`
- Search comparison: `deepEqual(current.search, next.search, { partial: !exact })`
- Hash comparison: optional, `current.hash === next.hash`
- Active adds `data-status="active"` + `aria-current="page"`
- Transitioning adds `data-transitioning="transitioning"`

**`createLink(Comp)`** — creates a router-aware wrapper for any host component.

---

## File-Based Routing

### Generator Config (`tsr.config.json`)

```ts
{
  target: 'react' | 'solid' | 'vue'          // default: 'react'
  routesDirectory: string                      // default: './src/routes'
  generatedRouteTree: string                   // default: './src/routeTree.gen.ts'
  routeFilePrefix?: string                     // only include files with this prefix
  routeFileIgnorePrefix: string               // default: '-'
  routeFileIgnorePattern?: string             // regex
  indexToken: TokenMatcher                    // default: 'index'
  routeToken: TokenMatcher                    // default: 'route'
  autoCodeSplitting?: boolean
  verboseFileRoutes?: boolean
  enableRouteTreeFormatting: boolean          // default: true
  disableTypes: boolean                       // default: false
  quoteStyle: 'single' | 'double'            // default: 'single'
  semicolons: boolean                         // default: false
  plugins?: Array<GeneratorPlugin>
  tmpDir: string                              // default: '.tanstack/tmp'
  customScaffolding?: {
    routeTemplate?: string
    lazyRouteTemplate?: string
  }
}
```

### Naming Conventions

| File/Segment | Type            | Effect                                    |
| ------------ | --------------- | ----------------------------------------- |
| `__root.tsx` | Root route      | Root of all routes                        |
| `index.tsx`  | Index           | Renders at exact parent path              |
| `route.tsx`  | Layout          | Layout for parent path segment            |
| `$param`     | Dynamic         | URL parameter segment                     |
| `$...name`   | Splat           | Catch-all parameter                       |
| `_prefix`    | Pathless layout | No URL contribution, wraps children       |
| `(group)`    | Route group     | Organization only, no URL contribution    |
| `.lazy.tsx`  | Lazy chunk      | Split into separate bundle                |
| `[bracket]`  | Escape          | Literal segment (escapes special meaning) |
| `-prefix`    | Ignored         | Excluded from route tree                  |

FsRouteType enum: `'__root' | 'static' | 'layout' | 'pathless_layout' | 'lazy'`

### Generated Output (`routeTree.gen.ts`)

1. Imports of each route file
2. `.update({ id, path, getParentRoute })` calls wiring each route into tree
3. `.lazy(() => import('./foo.lazy').then(d => d.Route))` for lazy routes
4. `.update({ component: lazyRouteComponent(...) })` for split components
5. Interface declarations: `FileRoutesByFullPath`, `FileRoutesByTo`, `FileRoutesById`, `FileRouteTypes`
6. `routeTree = rootRoute._addFileChildren(children)._addFileTypes<FileRouteTypes>()`
7. Module augmentation for `verboseFileRoutes: false`

Generator maintains `routeNodeCache` (mtime-based) and only rewrites when changed.

---

## Code Splitting (Router Plugin)

Uses **Babel AST transforms** to produce three virtual module types per route file:

### Reference File (the real file)

`compileCodeSplitReferenceRoute` — for each splittable key:

- Adds `const $$splitComponentImporter = () => import('./route?tsr-split=component')`
- Replaces prop value with `lazyRouteComponent($$splitComponentImporter, 'component')`
- For `loader`: uses `lazyFn($$splitLoaderImporter, 'loader')`
- Runs dead-code elimination to remove unused imports

### Virtual Split File (`?tsr-split=component`)

`compileCodeSplitVirtualRoute` — strips everything except targeted prop(s), exports as `{ SplitComponent as component }`.

### Shared File (`?tsr-shared=1`)

Created when a binding is referenced by both split and non-split props. Contains only shared bindings. The `Route` singleton is explicitly excluded to prevent duplication.

### Split Node Map

```ts
'loader'            → lazyFn(...)
'component'         → lazyRouteComponent(...)
'pendingComponent'  → lazyRouteComponent(...)
'errorComponent'    → lazyRouteComponent(...)
'notFoundComponent' → lazyRouteComponent(...)
```

Per-route override: `codeSplitGroupings: [['component', 'pendingComponent'], ['loader']]`.

---

## SSR / Streaming

### DehydratedRouter

```ts
interface DehydratedMatch {
  i: string; // match.id
  b?: any; // __beforeLoadContext
  l?: any; // loaderData
  e?: any; // error
  u: number; // updatedAt
  s: string; // status
  ssr?: any;
}

interface DehydratedRouter {
  manifest?: Manifest;
  dehydratedData?: any;
  lastMatchId?: string;
  matches: Array<DehydratedMatch>;
}
```

### Server: ScriptBuffer + Dehydration

`attachRouterServerSsrUtils` sets up `router.serverSsr`:

- `dehydrate()` — calls `crossSerializeStream` (seroval) on `DehydratedRouter`; each chunk enqueued to `ScriptBuffer`
- `injectHtml(html)` — buffers HTML, emits `onInjectedHtml`
- `injectScript(script)` — wraps in `<script>`, calls `injectHtml`
- `setRenderFinished()` — calls listeners, lifts script barrier
- `takeBufferedHtml()` — drains injection buffer

**ScriptBuffer**: Queue of serialized script chunks with a "barrier" — scripts buffered until `liftBarrier()` called after HTML stream sends `TSR_SCRIPT_BARRIER_ID` marker. Uses `queueMicrotask` to batch. Scripts joined with `;` and appended with `;document.currentScript.remove()`.

### transformStreamWithRouter

Wraps the app `ReadableStream`:

1. Subscribes to `router.onInjectedHtml` — buffers router HTML
2. Scans each chunk for `TSR_SCRIPT_BARRIER_ID` → calls `liftScriptBarrier()`
3. Scans for `</body>` → captures closing tags, flushes router HTML before them
4. After render: waits for serialization, flushes remaining bytes, closes stream
5. 60-second timeouts for both serialization and stream lifetime

### Client Hydration

`window.$_TSR` holds `TsrSsrGlobal`:

```ts
interface TsrSsrGlobal {
  router?: DehydratedRouter;
  h: () => void; // signal hydration complete
  e: () => void; // signal stream ended
  c: () => void; // cleanup
  p: (script: () => void) => void; // push to buffer or execute
  buffer: Array<() => void>;
  t?: Map<string, (value: any) => any>; // custom transformers
  initialized?: boolean;
  hydrated?: boolean;
  streamEnded?: boolean;
}
```

`hydrate(router)`:

1. Reads `window.$_TSR.router`
2. Calls `router.matchRoutes()`, loads route chunks in parallel
3. `hydrateMatch()` populates `loaderData`, `__beforeLoadContext`, `error`
4. Awaits hydration complete promise (resolves when `window.$_TSR.e()` called)

---

## Middleware (TanStack Start)

### Two Types

1. **`'request'`** (default) — runs per HTTP request; access to `Request`, `pathname`, `context`
2. **`'function'`** — runs per server function call; access to `data`, `context`, `method`, `signal`

### createMiddleware (fluent builder)

```ts
const authMiddleware = createMiddleware({ type: "request" })
  .middleware([otherMiddleware])
  .server(async ({ context, next, request, pathname }) => {
    // server-side phase
    const result = await next({ context: { ...context, user } });
    return result;
  })
  .client(async ({ context, next, data }) => {
    // client-side phase (function middleware only)
    const result = await next({ context: { ...context } });
    return result;
  });
```

**Request middleware** can return a `Response` directly to short-circuit.

**Function middleware** additionally has `.inputValidator(schema)` for input validation.

### Context Accumulation

Each `next({ context: additionalCtx })` merges into accumulated context via `IntersectAssign`. Types track this via:

- `AssignAllServerFnContext<TRegister, TMiddlewares, TSendContext, TServerContext>`
- `AssignAllServerRequestContext<TRegister, TMiddlewares, ...>`

### Execution Model

Standard onion model:

```ts
function executeMiddleware(middlewares, ctx) {
  async function dispatch(i, ctx) {
    const middleware = middlewares[i];
    if (!middleware) return ctx;
    return await middleware({ ...ctx, next: (ctx) => dispatch(i + 1, ctx) });
  }
  return dispatch(0, ctx);
}
```

### Global vs Route Middleware

- **Global**: `createStart({ requestMiddleware: [...] })` — runs for every request
- **Route-level**: `server: { middleware: [...] }` in route options
- Tracked in `Set<AnyRequestMiddleware>` (`executedRequestMiddlewares`) to prevent double-execution

---

## History Abstraction (`@tanstack/history`)

### RouterHistory Interface

```ts
interface RouterHistory {
  location: HistoryLocation;
  length: number;
  subscribers: Set<(opts: { location; action }) => void>;
  subscribe: (cb) => () => void;
  push: (path, state?, opts?) => void;
  replace: (path, state?, opts?) => void;
  go: (index, opts?) => void;
  back: (opts?) => void;
  forward: (opts?) => void;
  canGoBack: () => boolean;
  createHref: (href) => string;
  block: (blocker: NavigationBlocker) => () => void;
  flush: () => void; // immediately commit pending URL change
  destroy: () => void;
  notify: (action) => void;
}

interface ParsedHistoryState {
  __TSR_key?: string;
  __TSR_index: number; // monotonically increasing, for back/forward detection
}
```

### createBrowserHistory — Microtask Throttle

The key optimization — batches rapid navigations:

```ts
let next: { href; state; isPush } | undefined;
let scheduled: Promise<void> | undefined;

const queueHistoryAction = (type, destHref, state) => {
  currentLocation = parseHref(destHref, state); // update in-memory immediately
  next = { href, state, isPush: next?.isPush || type === "push" };
  if (!scheduled) {
    scheduled = Promise.resolve().then(() => flush());
  }
};

const flush = () => {
  (next.isPush ? history.pushState : history.replaceState)(
    next.state,
    "",
    next.href
  );
  next = undefined;
  scheduled = undefined;
};
```

Multiple `navigate()` calls in the same sync tick → **one** browser history entry. `isPush` uses `||` to prefer push if any call was push.

### createHashHistory

Wraps `createBrowserHistory` with custom `parseLocation` (reads from `window.location.hash`) and `createHref` (prepends `#`). Same microtask batching.

### createMemoryHistory

Pure in-memory for SSR/testing. Array-based push/replace/go. **No** microtask batching.

### History State Augmentation

`router-core` augments `@tanstack/history`:

```ts
declare module "@tanstack/history" {
  interface HistoryState {
    __tempLocation?: HistoryLocation; // for route masking
    __tempKey?: string; // masked location lifetime
    __hashScrollIntoViewOptions?: boolean | ScrollIntoViewOptions;
  }
}
```

---

## Scroll Restoration

### Storage

`sessionStorage` under key `tsr-scroll-restoration-v1_3` (versioned).

```ts
type ScrollRestorationByKey = Record<
  string,
  Record<string, { scrollX: number; scrollY: number }>
>;
// outer key: route location key (TSR_key or href)
// inner key: CSS selector or 'window'
```

### Setup (`setupScrollRestoration`)

1. `window.history.scrollRestoration = 'manual'` — disables browser native restoration
2. Document-level `scroll` listener (throttled 100ms) captures:
   - `window` for document scroll
   - `[data-scroll-restoration-id="xxx"]` elements by attribute
   - Fallback: `getCssSelector(element)` (nth-child CSS path)
3. Subscribes to router `onRendered` event → `restoreScroll()`

### Restoration Priority

1. **Cached entry exists** AND `shouldScrollRestoration` enabled → restore all registered elements
2. **URL has hash** → `element.scrollIntoView()` using `__hashScrollIntoViewOptions`
3. **Default** → `window.scrollTo({ top: 0, left: 0 })` + scroll `scrollToTopSelectors` to top

### Router Options

```ts
scrollRestoration?: boolean | ((opts: { location }) => boolean)
scrollRestorationBehavior?: ScrollToOptions['behavior']   // 'smooth' | 'instant' | 'auto'
getScrollRestorationKey?: (location: ParsedLocation) => string
scrollToTopSelectors?: Array<string | (() => Element | null | undefined)>
```

---

## Navigation Blocking

### useBlocker Hook (react-router)

```ts
type UseBlockerOpts<TRouter, TWithResolver extends boolean> = {
  shouldBlockFn: (args: {
    current: ShouldBlockFnLocation; // { routeId, fullPath, pathname, params, search }
    next: ShouldBlockFnLocation;
    action: HistoryAction;
  }) => boolean | Promise<boolean>;
  enableBeforeUnload?: boolean | (() => boolean);
  disabled?: boolean;
  withResolver?: TWithResolver;
};

function useBlocker<TWithResolver = false>(
  opts: UseBlockerOpts<TRouter, TWithResolver>
): TWithResolver extends true ? BlockerResolver : void;
```

### withResolver Pattern

When `withResolver: true`, returns a `BlockerResolver`:

```ts
type BlockerResolver =
  | { status: 'blocked'; current; next; action; proceed: () => void; reset: () => void }
  | { status: 'idle'; current: undefined; next: undefined; ... }
```

When blocked, a `Promise<boolean>` is created. `proceed()` calls `resolve(false)` (allow navigation), `reset()` calls `resolve(true)` (cancel). UI shows `blocked` state until user decides.

### Block Component (declarative)

```ts
function Block<TWithResolver extends boolean>(
  opts: UseBlockerOpts & { children?: ReactNode | ((resolver) => ReactNode) }
): React.ReactNode;
```

Blocker registered via `history.block({ blockerFn, enableBeforeUnload })`. `beforeunload` handler checks blockers for tab close. Back/forward detection uses `__TSR_index` comparison.

---

## Head / Meta Management

### Route head() Option

```ts
head?: (ctx: AssetFnContextOptions) => Awaitable<{
  links?: Array<RouterManagedTag>     // <link>
  scripts?: Array<RouterManagedTag>   // <script> in head
  meta?: Array<RouterManagedTag>      // <meta> + <title>
  styles?: Array<RouterManagedTag>    // <style>
}>
```

### RouterManagedTag

```ts
type RouterManagedTag =
  | { tag: "title"; attrs?: Record<string, any>; children: string }
  | { tag: "meta" | "link"; attrs?: Record<string, any>; children?: never }
  | { tag: "script"; attrs?: Record<string, any>; children?: string }
  | { tag: "style"; attrs?: Record<string, any>; children?: string };
```

### Aggregation Strategy (useTags → HeadContent)

- Tags from all active route matches collected
- **Deepest-wins for meta**: iterates from deepest match backwards, deduplicates by `name`/`property` attribute — first seen (deepest) wins
- **Title**: only the deepest title used
- **JSON-LD** (`script:ld+json`): always appended (no dedup)
- **Links, styles, scripts**: flat concatenation across all matches
- Manifest preload links (`rel: modulepreload`) added from ViteManifest per route
- Final dedup by `JSON.stringify(tag)` via `uniqBy`

```tsx
// Place in document shell:
<head>
  <HeadContent />
</head>
```

---

## Virtual File Routes

### Builder API

```ts
rootRoute(file: string, children?: VirtualRouteNode[]): VirtualRootRoute
index(file: string): IndexRoute
layout(file: string, children: VirtualRouteNode[]): LayoutRoute
layout(id: string, file: string, children: VirtualRouteNode[]): LayoutRoute
route(path: string, children: VirtualRouteNode[]): Route        // path-only
route(path: string, file: string): Route                         // leaf
route(path: string, file: string, children: VirtualRouteNode[]): Route
physical(directory: string): PhysicalSubtree
physical(pathPrefix: string, directory: string): PhysicalSubtree
```

### Types

```ts
type VirtualRouteNode = IndexRoute | LayoutRoute | Route | PhysicalSubtree;
type IndexRoute = { type: "index"; file: string };
type LayoutRoute = {
  type: "layout";
  id?: string;
  file: string;
  children?: VirtualRouteNode[];
};
type Route = {
  type: "route";
  file?: string;
  path: string;
  children?: VirtualRouteNode[];
};
type PhysicalSubtree = {
  type: "physical";
  directory: string;
  pathPrefix: string;
};
```

### PhysicalSubtree Bridge

`physical(pathPrefix, directory)` mounts a filesystem directory at a path prefix. The generator crawls it using normal physical route scanning — allows **mixing programmatic and filesystem routes**.

### Config Integration

- Set `virtualRouteConfig` in `tsr.config.json` to a file path, **or**
- Place `__virtual.[mc]?[jt]s` in any subdirectory
- Export can be `VirtualRouteSubtreeConfig` value or async function returning one

---

## Error Handling

### Error Boundary Layers

Per-match rendering order:

1. **`CatchBoundary`** — wraps each match's component
   - `getResetKey` returns `fetchCount` — resets boundary when route re-fetches
   - `getDerivedStateFromProps` compares keys → auto-resets on navigation
   - Shows `errorComponent` (route-specific or default)

2. **`CatchNotFound`** — wraps inside CatchBoundary
   - Re-throws non-not-found errors (propagate to parent error boundary)
   - Reset key: `not-found-${pathname}-${status}`
   - Shows `notFoundComponent`

3. **`MatchInner`** — the actual route component render

### notFound() Function

```ts
function notFound(options: NotFoundError = {}): NotFoundError;
// NotFoundError = {
//   data?: any
//   throw?: boolean           // throws instead of returns
//   routeId?: RouteIds<...>   // target specific route's boundary
//   headers?: HeadersInit
// }
```

Sets `isNotFound = true` as sentinel. Check with `isNotFound(obj)`.

### Error Propagation

For errors:

1. Route's own `errorComponent` → parent's → root's → `DefaultErrorComponent`

For 404s:

1. Route's `notFoundComponent` → parent's → root's → `DefaultGlobalNotFound` (`<p>Not Found</p>`)

`notFoundMode: 'fuzzy'` (default) allows any route to handle 404s. `'root'` forces all 404s to the root route.

---

## Key Patterns

**Match ID uniqueness:** `matchId = route.id + interpolatedPath + JSON.stringify(loaderDeps)` — same route with different params or deps gets different cache entries.

**Structural sharing:** `replaceEqualDeep` on search, params, state, loaderDeps during match creation preserves reference identity when values unchanged — prevents re-renders.

**SearchSchemaInput trick:** Separate input/output types — function parameter type (extending `SearchSchemaInput`) becomes the "input type" for `search` props, return type is the "output/validated type" in loaders and components.

**Register augmentation:** Central mechanism connecting route tree to all hooks globally — resolve `RegisteredRouter['routeTree']` without explicit type parameters.

**Microtask batching:** Multiple `navigate()` calls in same tick produce one browser history entry. In-memory location updates immediately, browser URL updates on next microtask.

---

## Key Source File Locations

| Topic                        | Package             | Path                                       |
| ---------------------------- | ------------------- | ------------------------------------------ |
| Router class + state         | router-core         | `src/router.ts`                            |
| Route definition             | router-core         | `src/route.ts`                             |
| Route type utilities         | router-core         | `src/routeInfo.ts`                         |
| ParsePathParams + Link types | router-core         | `src/link.ts`                              |
| Search params parsing        | router-core         | `src/searchParams.ts`                      |
| Search middleware            | router-core         | `src/searchMiddleware.ts`                  |
| Match loading                | router-core         | `src/load-matches.ts`                      |
| History abstraction          | history             | `src/index.ts`                             |
| Scroll restoration           | router-core         | `src/scroll-restoration.ts`                |
| Not-found utilities          | router-core         | `src/not-found.ts`                         |
| SSR server dehydration       | router-core         | `src/ssr/ssr-server.ts`                    |
| SSR stream transform         | router-core         | `src/ssr/ssr-client.ts`                    |
| SSR types                    | router-core         | `src/ssr/types.ts`                         |
| File-based route config      | router-generator    | `src/config.ts`                            |
| FS route scanner             | router-generator    | `src/filesystem/physical/getRouteNodes.ts` |
| Route tree generator         | router-generator    | `src/generator.ts`                         |
| Code splitting transforms    | router-plugin       | `src/core/code-splitter/compilers.ts`      |
| Virtual routes API           | virtual-file-routes | `src/api.ts`                               |
| Link component               | react-router        | `src/link.tsx`                             |
| useBlocker                   | react-router        | `src/useBlocker.tsx`                       |
| CatchBoundary                | react-router        | `src/CatchBoundary.tsx`                    |
| CatchNotFound                | react-router        | `src/not-found.tsx`                        |
| HeadContent + useTags        | react-router        | `src/headContentUtils.tsx`                 |
| Start middleware             | start-client-core   | `src/createMiddleware.ts`                  |
| Middleware execution         | start-server-core   | `src/createStartHandler.ts`                |
