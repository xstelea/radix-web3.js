# Effect RPC — Deep Analysis

Comprehensive reference for `@effect/rpc` (v0.73.0) — type-safe, transport-agnostic RPC framework built on Effect. Define procedures with schemas, group them, implement handlers, then serve over WebSocket, HTTP, Socket, Worker, or Stdio with automatic serialization, streaming, middleware, and distributed tracing.

---

## Table of Contents

- [Package Overview](#package-overview)
- [Module Map](#module-map)
- [Rpc (Procedure Definition)](#rpc-procedure-definition)
- [RpcGroup](#rpcgroup)
- [RpcServer](#rpcserver)
- [RpcClient](#rpcclient)
- [RpcMiddleware](#rpcmiddleware)
- [RpcMessage](#rpcmessage)
- [RpcSerialization](#rpcserialization)
- [RpcSchema](#rpcschema)
- [RpcTest](#rpctest)
- [RpcWorker](#rpcworker)
- [RpcClientError](#rpcclienterror)
- [Wrapper (fork / uninterruptible)](#wrapper-fork--uninterruptible)
- [End-to-End Example](#end-to-end-example)
- [Architecture Flow](#architecture-flow)
- [Key Patterns](#key-patterns)
- [Quick Reference](#quick-reference)

---

## Package Overview

```
@effect/rpc v0.73.0
"Type-safe, transport-agnostic RPC for Effect"
```

**Purpose**: Define RPC procedures with Schema-validated payloads, success types, and errors. Group them, attach middleware, then serve over any transport — WebSocket, HTTP, raw sockets, workers, or stdio. Clients are auto-generated with full type safety.

### Dependencies

| Dependency                | Purpose                                         |
| ------------------------- | ----------------------------------------------- |
| `@effect/platform` (peer) | HTTP server/client, Socket, Worker abstractions |
| `effect` (peer)           | Core Effect library                             |
| `msgpackr`                | MessagePack binary serialization (via platform) |

### Exports Pattern

```json
{
  ".": "./src/index.ts",
  "./*": "./src/*.ts",
  "./internal/*": null
}
```

- **Barrel export**: `import { Rpc, RpcClient, RpcServer } from "@effect/rpc"`
- **Direct module**: `import * as Rpc from "@effect/rpc/Rpc"` (tree-shakeable)
- **Internal blocked**: `./internal/*` mapped to `null`

---

## Module Map

| Module             | Purpose                                                     |
| ------------------ | ----------------------------------------------------------- |
| `Rpc`              | Procedure definition, type extractors, Wrapper              |
| `RpcGroup`         | Group procedures, add middleware/prefix, implement handlers |
| `RpcServer`        | Server engine + Protocol tag + 6 transport implementations  |
| `RpcClient`        | Client engine + Protocol tag + 4 transport implementations  |
| `RpcMiddleware`    | Middleware Tag factory, server & client middleware          |
| `RpcMessage`       | Wire protocol types (FromClient, FromServer)                |
| `RpcSerialization` | Serialization service + 5 built-in formats                  |
| `RpcSchema`        | Stream schema wrapper for streaming RPCs                    |
| `RpcTest`          | In-memory test client (no serialization)                    |
| `RpcWorker`        | Worker-specific InitialMessage support                      |
| `RpcClientError`   | Client error type (TaggedError)                             |
| **Total**          | **11 public modules**                                       |

---

## Rpc (Procedure Definition)

**Module**: `Rpc.ts` — Define individual RPC procedures with Schema-validated payload, success, and error types.

### Constructor

```typescript
import { Rpc } from "@effect/rpc";

const GetUser = Rpc.make("GetUser", {
  payload: { id: Schema.Number }, // Schema.Struct.Fields or Schema.Schema
  success: Schema.Struct({ name: Schema.String }),
  error: Schema.String,
});

// Streaming RPC
const WatchUsers = Rpc.make("WatchUsers", {
  success: Schema.Struct({ name: Schema.String }),
  error: Schema.String,
  stream: true, // success becomes Stream, error moves to stream errors
});

// With primaryKey (for deduplication)
const GetItem = Rpc.make("GetItem", {
  payload: { id: Schema.String },
  primaryKey: (payload) => payload.id,
});
```

### Rpc.make() Options

| Option       | Type                                    | Default        | Description                                          |
| ------------ | --------------------------------------- | -------------- | ---------------------------------------------------- |
| `payload`    | `Schema.Struct.Fields \| Schema.Schema` | `Schema.Void`  | Request payload schema                               |
| `success`    | `Schema.Schema`                         | `Schema.Void`  | Success response schema                              |
| `error`      | `Schema.Schema`                         | `Schema.Never` | Error schema                                         |
| `stream`     | `boolean`                               | `false`        | Wrap success as `RpcSchema.Stream`                   |
| `primaryKey` | `(payload) => string`                   | —              | PrimaryKey for dedup (payload must be Struct.Fields) |

### Fluent Combinators

```typescript
const MyRpc = Rpc.make("MyRpc")
  .setPayload({ id: Schema.Number })
  .setSuccess(Schema.String)
  .setError(MyError)
  .middleware(AuthMiddleware)
  .prefix("admin.") // tag becomes "admin.MyRpc"
  .annotate(tag, value)
  .annotateContext(context);
```

### Type Extractors

| Type                        | Extracts                                                                 |
| --------------------------- | ------------------------------------------------------------------------ |
| `Rpc.Tag<R>`                | The string tag                                                           |
| `Rpc.Payload<R>`            | Decoded payload type                                                     |
| `Rpc.PayloadConstructor<R>` | Constructor input (uses `Schema.Struct.Constructor` for struct payloads) |
| `Rpc.Success<R>`            | Decoded success type                                                     |
| `Rpc.SuccessSchema<R>`      | Success schema (may be `RpcSchema.Stream`)                               |
| `Rpc.Error<R>`              | Decoded error type (includes middleware errors)                          |
| `Rpc.ErrorSchema<R>`        | Union of error schema + middleware failure schemas                       |
| `Rpc.Context<R>`            | Schema context requirements                                              |
| `Rpc.Middleware<R>`         | Required middleware service identifiers                                  |
| `Rpc.MiddlewareClient<R>`   | Client-side middleware requirements (when `requiredForClient: true`)     |
| `Rpc.Exit<R>`               | `Exit<SuccessExit, ErrorExit>`                                           |
| `Rpc.IsStream<R, Tag>`      | `true` if the Rpc is a streaming procedure                               |
| `Rpc.ResultFrom<R, Ctx>`    | Handler return type (`Effect` or `Stream` depending on `stream`)         |

### fromTaggedRequest (Schema.TaggedRequest compat)

```typescript
// Interop with legacy Schema.TaggedRequest
const rpc = Rpc.fromTaggedRequest(myTaggedRequestSchema);
```

### exitSchema

```typescript
// Get the Exit schema for encoding/decoding exits on the wire
const schema = Rpc.exitSchema(myRpc);
// Schema.Schema<Exit<Success, Error>, ExitEncoded<...>>
```

---

## RpcGroup

**Module**: `RpcGroup.ts` — Group procedures together, apply shared middleware/prefix, implement handlers.

### Constructor

```typescript
import { RpcGroup } from "@effect/rpc";

const group = RpcGroup.make(GetUser, ListUsers, WatchUsers);
```

### Fluent API

```typescript
group
  .add(DeleteUser, UpdateUser) // add more procedures
  .merge(otherGroup) // merge another group
  .middleware(AuthMiddleware) // apply middleware to all above
  .prefix("users.") // prefix all tags: "users.GetUser"
  .annotate(tag, value) // annotate the group
  .annotateRpcs(tag, value); // annotate all rpcs in group
```

### Implementing Handlers — toLayer

```typescript
// All handlers at once — returns Layer<Rpc.ToHandler<Rpcs>>
const HandlersLive = group.toLayer({
  GetUser: (payload, { headers, clientId }) =>
    Effect.succeed({ name: "Alice" }),
  ListUsers: () => Effect.succeed([{ name: "Alice" }]),
  WatchUsers: () => Stream.fromIterable([{ name: "Alice" }]),
});

// Single handler
const GetUserLive = group.toLayerHandler("GetUser", (payload, { headers }) =>
  Effect.succeed({ name: "Alice" })
);

// Effectful build (access services during construction)
const HandlersLive = group.toLayer(
  Effect.gen(function* () {
    const db = yield* Database;
    return {
      GetUser: (payload) => db.findUser(payload.id),
      // ...
    };
  })
);
```

### Handler Function Signature

```typescript
type HandlerFn = (
  payload: Rpc.Payload<Current>,
  options: { readonly clientId: number; readonly headers: Headers }
) => Effect<Success, Error, R> | Stream<A, E, R> | Wrapper<...>
```

For streaming RPCs, handlers can return:

- `Stream<A, E, R>` — standard stream
- `Effect<ReadonlyMailbox<A, E>, E, R>` — mailbox-based streaming
- `Wrapper<Stream<...>>` — with fork/uninterruptible wrapping

### accessHandler

```typescript
// Retrieve a handler from context for direct invocation
const handler = yield * group.accessHandler("GetUser");
const result = handler(payload, headers);
```

### Rpcs type extractor

```typescript
type MyRpcs = RpcGroup.Rpcs<typeof group>;
// Union of all Rpc types in the group
```

---

## RpcServer

**Module**: `RpcServer.ts` — Server engine that dispatches incoming RPC messages to handlers. The `Protocol` tag abstracts the transport layer.

### Protocol Tag (Server)

```typescript
class Protocol extends Context.Tag("@effect/rpc/RpcServer/Protocol")<Protocol, {
  readonly run: (f: (clientId: number, data: FromClientEncoded) => Effect<void>) => Effect<never>
  readonly disconnects: ReadonlyMailbox<number>
  readonly send: (clientId: number, response: FromServerEncoded, transferables?: Transferable[]) => Effect<void>
  readonly end: (clientId: number) => Effect<void>
  readonly clientIds: Effect<ReadonlySet<number>>
  readonly initialMessage: Effect<Option<unknown>>
  readonly supportsAck: boolean
  readonly supportsTransferables: boolean
  readonly supportsSpanPropagation: boolean
}>()
```

### Server Constructors

```typescript
// Low-level: no serialization (works with decoded types)
RpcServer.makeNoSerialization(group, {
  onFromServer: (response) => ...,
  concurrency: 10,              // default: "unbounded"
  disableTracing: false,
  spanPrefix: "RpcServer",
  disableClientAcks: false,
  disableFatalDefects: false,
})

// Full server: serialization + protocol
RpcServer.make(group, options?)
// Returns Effect<never> — runs until interrupted

// Layer variant
RpcServer.layer(group, options?)
// Returns Layer<never, never, Protocol | Handlers | Middleware>
```

### Protocol Implementations (Server)

| Function                                 | Transport                          | Requires                          |
| ---------------------------------------- | ---------------------------------- | --------------------------------- |
| `layerProtocolWebsocket({ path })`       | WebSocket via HttpRouter           | RpcSerialization                  |
| `layerProtocolWebsocketRouter({ path })` | WebSocket via HttpLayerRouter      | RpcSerialization, HttpLayerRouter |
| `layerProtocolHttp({ path })`            | Streaming HTTP via HttpRouter      | RpcSerialization                  |
| `layerProtocolHttpRouter({ path })`      | Streaming HTTP via HttpLayerRouter | RpcSerialization, HttpLayerRouter |
| `layerProtocolSocketServer`              | Raw Socket                         | RpcSerialization, SocketServer    |
| `layerProtocolWorkerRunner`              | Worker thread                      | WorkerRunner.PlatformRunner       |
| `layerProtocolStdio({ stdin, stdout })`  | Stdio streams                      | RpcSerialization                  |

### Convenience Layers

```typescript
// All-in-one: group + path + protocol choice
RpcServer.layerHttpRouter({
  group: myGroup,
  path: "/rpc",
  protocol: "websocket",       // or "http" (default: "websocket")
  concurrency: 10,
})

// HttpApp constructors (for custom routing)
RpcServer.toHttpApp(group, options?)        // HTTP streaming app
RpcServer.toHttpAppWebsocket(group, options?) // WebSocket app

// Web standard handler (edge deployments)
const { handler, dispose } = RpcServer.toWebHandler(group, {
  layer: HandlersLive.pipe(Layer.provide(RpcSerialization.layerJson)),
  middleware: HttpMiddleware.logger,
})
// handler: (request: Request) => Promise<Response>
```

### Concurrency Control

- `concurrency: "unbounded"` (default) — all requests run concurrently
- `concurrency: N` — semaphore-based, limits N concurrent requests
- `Rpc.fork(result)` — bypasses concurrency control for that request
- `Rpc.uninterruptible(result)` — runs in uninterruptible region

### Interruption Fiber IDs

```typescript
RpcServer.fiberIdClientInterrupt; // FiberId(-499) — client-initiated interrupt
RpcServer.fiberIdTransientInterrupt; // FiberId(-503) — transient (shutdown, reconnect)
```

---

## RpcClient

**Module**: `RpcClient.ts` — Auto-generated typed client stubs with prefix-based namespacing.

### Client Type

```typescript
type RpcClient<Rpcs, E> = {
  readonly GetUser: (payload, options?) => Effect<User, MyError | E>;
  readonly WatchUsers: (payload, options?) => Stream<User, MyError | E>;

  // Prefixed RPCs create nested namespaces
  readonly admin: {
    readonly DeleteUser: (payload, options?) => Effect<void, AdminError | E>;
  };
};
```

### Client Constructor

```typescript
// Full client with serialization
const client = yield* RpcClient.make(group, {
  spanPrefix: "RpcClient",
  disableTracing: false,
  flatten: false,              // true → flat function client(tag, payload)
})

// Low-level: no serialization
const { client, write } = yield* RpcClient.makeNoSerialization(group, {
  onFromClient: ({ message, context, discard }) => ...,
  supportsAck: true,
  flatten: false,
})
```

### Calling RPCs

```typescript
// Effect-based (non-streaming)
const user = yield * client.GetUser({ id: 1 });

// With options
const user =
  yield *
  client.GetUser(
    { id: 1 },
    {
      headers: { authorization: "Bearer ..." },
      context: Context.empty(),
      discard: true, // fire-and-forget (returns void)
    }
  );

// Stream-based
const users: Stream<User, Error> = client.WatchUsers({});

// Stream as Mailbox
const mailbox =
  yield *
  client.WatchUsers(
    {},
    {
      asMailbox: true,
      streamBufferSize: 16,
    }
  );
```

### Flat Client

```typescript
const client = yield * RpcClient.make(group, { flatten: true });
// client: (tag: "GetUser" | ..., payload, options?) => Effect | Stream
const user = yield * client("GetUser", { id: 1 });
```

### Protocol Tag (Client)

```typescript
class Protocol extends Context.Tag("@effect/rpc/RpcClient/Protocol")<Protocol, {
  readonly run: (f: (data: FromServerEncoded) => Effect<void>) => Effect<never>
  readonly send: (request: FromClientEncoded, transferables?: Transferable[]) => Effect<void, RpcClientError>
  readonly supportsAck: boolean
  readonly supportsTransferables: boolean
}>()
```

### Protocol Implementations (Client)

| Function                        | Transport        | Requires                              |
| ------------------------------- | ---------------- | ------------------------------------- |
| `layerProtocolHttp({ url })`    | HTTP POST        | RpcSerialization, HttpClient          |
| `layerProtocolSocket(options?)` | WebSocket/Socket | RpcSerialization, Socket              |
| `layerProtocolWorker({ size })` | Worker pool      | Worker.PlatformWorker, Worker.Spawner |

### Headers

```typescript
// Set headers for all RPCs in scope
RpcClient.withHeaders({ authorization: "Bearer ..." })(effect);

// Effectful headers
RpcClient.withHeadersEffect(getTokenEffect)(effect);

// FiberRef for current headers
RpcClient.currentHeaders; // FiberRef<Headers>
```

### Socket Protocol Options

```typescript
RpcClient.layerProtocolSocket({
  retryTransientErrors: true,
  retrySchedule: Schedule.exponential(500, 1.5).pipe(
    Schedule.union(Schedule.spaced(5000))
  ),
});
```

### Worker Protocol Options

```typescript
RpcClient.layerProtocolWorker({
  size: 4, // fixed pool
  // or elastic pool:
  minSize: 1,
  maxSize: 8,
  concurrency: 10,
  targetUtilization: 0.8,
  timeToLive: "5 minutes",
});
```

---

## RpcMiddleware

**Module**: `RpcMiddleware.ts` — Middleware system with Tag-based registration, provides/wrap/optional modes.

### Creating Middleware Tags

```typescript
import { RpcMiddleware } from "@effect/rpc";

// Basic middleware (runs before handler, can fail with typed error)
class AuthMiddleware extends RpcMiddleware.Tag<AuthMiddleware>()(
  "AuthMiddleware",
  { failure: AuthError }
) {}

// Middleware that provides a service to the handler
class UserContext extends RpcMiddleware.Tag<UserContext>()("UserContext", {
  provides: UserService, // Context.Tag to provide
  failure: AuthError,
}) {}

// Optional middleware (handler runs even if middleware fails)
class Analytics extends RpcMiddleware.Tag<Analytics>()("Analytics", {
  optional: true,
}) {}

// Wrap middleware (gets access to `next` — the handler effect)
class Caching extends RpcMiddleware.Tag<Caching>()("Caching", {
  wrap: true,
  failure: CacheError,
}) {}

// Client-required middleware (also runs on client side)
class RequestSigning extends RpcMiddleware.Tag<RequestSigning>()(
  "RequestSigning",
  { requiredForClient: true }
) {}
```

### Tag Options

| Option              | Type                | Default        | Description                                      |
| ------------------- | ------------------- | -------------- | ------------------------------------------------ |
| `failure`           | `Schema.Schema.All` | `Schema.Never` | Error schema (added to each Rpc's error union)   |
| `provides`          | `Context.Tag<I, S>` | —              | Service to provide to handler after middleware   |
| `optional`          | `boolean`           | `false`        | If true, handler runs even when middleware fails |
| `wrap`              | `boolean`           | `false`        | If true, middleware receives `next` effect       |
| `requiredForClient` | `boolean`           | `false`        | If true, client also needs this middleware       |

### Server Middleware Function

```typescript
// Standard: (options) => Effect<Provides, Error>
const AuthLive = Layer.succeed(AuthMiddleware, (options) =>
  Effect.gen(function* () {
    const token = Headers.get(options.headers, "authorization");
    if (!token) return yield* Effect.fail(new AuthError());
    return yield* verifyToken(token);
  })
);

// Wrap: (options) => Effect<SuccessValue, Error>
const CachingLive = Layer.succeed(Caching, (options) =>
  Effect.gen(function* () {
    const cached = yield* checkCache(options.payload);
    if (cached) return cached as any;
    return yield* options.next; // call the actual handler
  })
);
```

### Client Middleware

```typescript
// Runs on the client side, transforms the request before sending
const SigningLive = RpcMiddleware.layerClient(RequestSigning, (options) =>
  Effect.succeed({
    ...options.request,
    headers: Headers.set(
      options.request.headers,
      "x-sig",
      sign(options.request)
    ),
  })
);
```

### Application Order (Server)

For each middleware attached to an Rpc:

1. **wrap** middleware: wraps the handler, receives `next`
2. **provides** middleware: runs before handler, provides service via `Effect.provideServiceEffect`
3. **standard** middleware: runs before handler via `Effect.zipRight`
4. **optional** middleware: runs before handler, failures are silently ignored

---

## RpcMessage

**Module**: `RpcMessage.ts` — Wire protocol message types.

### FromClient (Client → Server)

| Type         | Fields                                                              | Purpose                            |
| ------------ | ------------------------------------------------------------------- | ---------------------------------- |
| `Request<A>` | `id: RequestId, tag, payload, headers, traceId?, spanId?, sampled?` | New RPC request                    |
| `Ack`        | `requestId`                                                         | Stream backpressure acknowledgment |
| `Interrupt`  | `requestId, interruptors`                                           | Cancel a running request           |
| `Eof`        | —                                                                   | Client is done sending             |

### FromClientEncoded (Wire format)

Same structure but with `id: string`, `headers: [string, string][]`, plus `Ping`.

### FromServer (Server → Client)

| Type               | Fields                                               | Purpose                     |
| ------------------ | ---------------------------------------------------- | --------------------------- |
| `ResponseChunk<A>` | `clientId, requestId, values: NonEmptyReadonlyArray` | Stream data chunk           |
| `ResponseExit<A>`  | `clientId, requestId, exit: Exit`                    | Request completed           |
| `ResponseDefect`   | `clientId, defect`                                   | Fatal server defect         |
| `ClientEnd`        | `clientId`                                           | Server finished with client |

### FromServerEncoded (Wire format)

Same but with `requestId: string`, plus `Pong` and `ClientProtocolError`.

### RequestId

```typescript
type RequestId = Branded<bigint, RequestIdTypeId>;
const id = RequestId(42n); // from bigint
const id = RequestId("42"); // from string
```

### Constants

```typescript
RpcMessage.constEof; // { _tag: "Eof" }
RpcMessage.constPing; // { _tag: "Ping" }
RpcMessage.constPong; // { _tag: "Pong" }
```

---

## RpcSerialization

**Module**: `RpcSerialization.ts` — Serialization service with pluggable formats.

### Service Tag

```typescript
class RpcSerialization extends Context.Tag("@effect/rpc/RpcSerialization")<RpcSerialization, {
  unsafeMake(): Parser
  readonly contentType: string
  readonly includesFraming: boolean
}>()
```

### Parser Interface

```typescript
interface Parser {
  readonly decode: (data: Uint8Array | string) => ReadonlyArray<unknown>;
  readonly encode: (response: unknown) => Uint8Array | string | undefined;
}
```

### Built-in Formats

| Format        | Content-Type           | Framing | Binary | Layer              |
| ------------- | ---------------------- | ------- | ------ | ------------------ |
| `json`        | `application/json`     | No      | No     | `layerJson`        |
| `ndjson`      | `application/ndjson`   | Yes     | No     | `layerNdjson`      |
| `jsonRpc()`   | `application/json`     | No      | No     | `layerJsonRpc()`   |
| `ndJsonRpc()` | `application/json-rpc` | Yes     | No     | `layerNdJsonRpc()` |
| `msgPack`     | `application/msgpack`  | Yes     | Yes    | `layerMsgPack`     |

### Framing

- **No framing** (`includesFraming: false`): Protocol handles message boundaries. `decode` returns single-element array. Used with HTTP (one request = one message).
- **With framing** (`includesFraming: true`): Parser handles message boundaries itself via delimiters (newlines for NDJSON) or binary framing (MsgPack). Used with WebSocket/Socket streams.

### JSON-RPC Format

Maps Effect RPC messages to/from JSON-RPC 2.0:

- `Request` → `{ jsonrpc: "2.0", method: tag, params: payload, id }`
- `Exit(Success)` → `{ jsonrpc: "2.0", id, result }`
- `Exit(Failure)` → `{ jsonrpc: "2.0", id, error: { code, message, data: cause } }`
- `Defect` → `{ jsonrpc: "2.0", id: -32603, error: { _tag: "Defect", ... } }`
- Control messages (`Ack`, `Ping`, etc.) → `{ method: "@effect/rpc/Ack", ... }`

Supports batch requests (JSON arrays) with response correlation.

---

## RpcSchema

**Module**: `RpcSchema.ts` — Stream schema wrapper for streaming RPCs.

### Stream Schema

```typescript
interface Stream<
  A extends Schema.Any,
  E extends Schema.All,
> extends Schema.Schema<
  Stream<A["Type"], E["Type"]>,
  Stream<A["Encoded"], E["Encoded"]>,
  A["Context"] | E["Context"]
> {
  readonly success: A;
  readonly failure: E;
}

// Constructor
const streamSchema = RpcSchema.Stream({
  success: Schema.String,
  failure: Schema.String,
});
```

### Utilities

```typescript
RpcSchema.isStreamSchema(schema); // type guard
RpcSchema.isStreamSerializable(schema); // check WithResult schema
RpcSchema.getStreamSchemas(ast); // Option<{ success, failure }>
```

The `Stream` schema uses `Schema.declare` internally and annotates the AST with `StreamSchemaId` so the server/client can detect streaming RPCs and handle them differently.

---

## RpcTest

**Module**: `RpcTest.ts` — In-memory test client that bypasses serialization.

```typescript
import { RpcTest } from "@effect/rpc";

const client = yield * RpcTest.makeClient(group);
// or
const client = yield * RpcTest.makeClient(group, { flatten: true });
```

Internally wires `RpcClient.makeNoSerialization` directly to `RpcServer.makeNoSerialization` — messages pass in-memory without encoding/decoding. Requirements include `Scope`, handler layers, and middleware layers.

---

## RpcWorker

**Module**: `RpcWorker.ts` — Worker-specific InitialMessage support.

### InitialMessage Tag

```typescript
class InitialMessage extends Context.Tag("@effect/rpc/RpcWorker/InitialMessage")<
  InitialMessage,
  Effect<readonly [data: unknown, transfers: Transferable[]]>
>()
```

### Helpers

```typescript
// Create initial message with schema encoding + transferable collection
RpcWorker.makeInitialMessage(schema, effect);

// Layer for initial message
RpcWorker.layerInitialMessage(schema, build);

// Read initial message on server side
const msg = yield * RpcWorker.initialMessage(schema);
// Effect<A, NoSuchElementException | ParseError, Protocol | R>
```

---

## RpcClientError

**Module**: `RpcClientError.ts` — Client-side error type.

```typescript
class RpcClientError extends Schema.TaggedError<RpcClientError>(
  "@effect/rpc/RpcClientError"
)("RpcClientError", {
  reason: Schema.Literal("Protocol", "Unknown"),
  message: Schema.String,
  cause: Schema.optional(Schema.Defect),
})
```

All client protocol implementations emit `RpcClientError` for transport failures (connection errors, decode failures, etc.).

---

## Wrapper (fork / uninterruptible)

**Module**: `Rpc.ts` (Wrapper section) — Control execution behavior of handler responses.

```typescript
// Fork: bypass server concurrency control, run concurrently regardless
const handler = (payload) => Rpc.fork(Effect.succeed(result));

// Uninterruptible: run in uninterruptible region
const handler = (payload) => Rpc.uninterruptible(Effect.succeed(result));

// Both: composable
const handler = (payload) => Rpc.fork(Rpc.uninterruptible(myEffect));

// General form
Rpc.wrap({ fork: true, uninterruptible: true })(myEffect);
```

- `Rpc.fork(value)` — ensures the handler runs concurrently even when `RpcServer` has `concurrency: N`
- `Rpc.uninterruptible(value)` — wraps in an uninterruptible region
- Works with both `Effect` and `Stream` return values
- `Rpc.isWrapper(obj)` — type guard

---

## End-to-End Example

### 1. Define Procedures

```typescript
import { Rpc, RpcGroup, RpcSchema } from "@effect/rpc";
import * as Schema from "effect/Schema";

const GetUser = Rpc.make("GetUser", {
  payload: { id: Schema.Number },
  success: Schema.Struct({ name: Schema.String, age: Schema.Number }),
  error: Schema.String,
});

const WatchUsers = Rpc.make("WatchUsers", {
  success: Schema.Struct({ name: Schema.String }),
  error: Schema.String,
  stream: true,
});

const group = RpcGroup.make(GetUser, WatchUsers);
```

### 2. Implement Handlers

```typescript
const HandlersLive = group.toLayer({
  GetUser: ({ id }) => Effect.succeed({ name: "Alice", age: 30 }),
  WatchUsers: () => Stream.fromIterable([{ name: "Alice" }, { name: "Bob" }]),
});
```

### 3. Serve (WebSocket over HTTP)

```typescript
import { RpcServer, RpcSerialization } from "@effect/rpc";
import { HttpLayerRouter } from "@effect/platform";
import { NodeHttpServer } from "@effect/platform-node";

const ServerLive = RpcServer.layerHttpRouter({
  group,
  path: "/rpc",
  protocol: "websocket",
}).pipe(
  Layer.provide(HandlersLive),
  Layer.provide(RpcSerialization.layerJson),
  Layer.provide(HttpLayerRouter.layer),
  Layer.provide(NodeHttpServer.layer({ port: 3000 }))
);
```

### 4. Client

```typescript
import { RpcClient } from "@effect/rpc";
import { Socket } from "@effect/platform";

const ClientLive = Layer.scoped(MyClient, RpcClient.make(group)).pipe(
  Layer.provide(RpcClient.layerProtocolSocket()),
  Layer.provide(RpcSerialization.layerJson),
  Layer.provide(Socket.layerWebSocketConstructor),
  Layer.provide(Socket.makeWebSocket("ws://localhost:3000/rpc"))
);

// Usage
const user = yield * client.GetUser({ id: 1 });
const users = yield * Stream.runCollect(client.WatchUsers({}));
```

### 5. Test (In-Memory)

```typescript
const testClient =
  yield * RpcTest.makeClient(group).pipe(Effect.provide(HandlersLive));
const user = yield * testClient.GetUser({ id: 1 });
```

---

## Architecture Flow

### Full Request Lifecycle

```
CLIENT                                    SERVER
──────                                    ──────
Rpc.make("GetUser", { ... })              ← Shared definition
         │
RpcClient.make(group)
  → onRequest(rpc)
    → encode payload via Schema
    → attach headers, traceId, spanId
    → Protocol.send({                     Protocol.run(callback)
        _tag: "Request",                    → callback(clientId, encoded)
        id, tag, payload,       ──────►       → RpcSerialization.decode
        headers, traceId                      → Schema.decode(payload)
      })                                      → dispatch to Handler
                                              → handler(payload, { clientId, headers })
                                              → applyMiddleware(rpc, ...)
                                              → Effect/Stream result
                                              │
                                              ├─ Effect → Exit
                                              │   → Schema.encode(exit)
                                              │   → Protocol.send({
                                              │       _tag: "Exit",
      Protocol.run(callback) ◄──────          │       requestId, exit
        → callback(encoded)                   │     })
        → Schema.decode(exit)                 │
        → resume caller                       │
                                              ├─ Stream → Chunks + Exit
                                              │   → for each chunk:
      Protocol.run ◄────────────              │     Protocol.send({
        → decode chunk                        │       _tag: "Chunk",
        → mailbox.offerAll                    │       requestId, values
        → Protocol.send({                     │     })
            _tag: "Ack" ────────────►         │     → await Ack (backpressure)
          })                                  │
                                              │   → final Exit when done
```

### Stream Backpressure (Ack Protocol)

```
Server sends Chunk → Client receives → Client processes → Client sends Ack → Server sends next Chunk
```

Only active when both client and server `supportsAck: true` (WebSocket, Socket, Worker). HTTP protocol disables acks.

### Ping/Pong (Socket Protocol)

```
Client sends Ping every 10s → Server responds with Pong
If no Pong received → Client reconnects with retry schedule
```

---

## Key Patterns

### 1. Transport Abstraction via Protocol Tag

Both `RpcServer` and `RpcClient` define a `Protocol` service tag. The protocol implementations are thin adapters — the core RPC logic is transport-agnostic:

```typescript
// Server protocols:  WebSocket, HTTP, Socket, Worker, Stdio
// Client protocols:  HTTP, Socket, Worker
// Test:              Direct in-memory wiring
```

### 2. withRun — Buffered Initialization

The internal `withRun` utility solves a chicken-and-egg problem: the protocol needs a `write` function, but `write` depends on the protocol being ready. `withRun` buffers messages during initialization, then replays them when `run` takes over.

### 3. Schema-Driven Type Safety

Every RPC's payload, success, and error types flow through Schema for:

- Compile-time type checking (client stubs are fully typed)
- Runtime validation (payload decoded on server, exit decoded on client)
- Serialization (encoding/decoding for wire transport)

### 4. Prefix-Based Namespacing

```typescript
group.prefix("users.");
// "GetUser" → "users.GetUser"
// Client type: { readonly users: { readonly GetUser: ... } }
```

The dot separator creates nested client objects automatically.

### 5. Streaming as First-Class

`stream: true` in `Rpc.make` changes the entire pipeline:

- Success schema wraps in `RpcSchema.Stream`
- Server sends `Chunk` messages instead of a single `Exit`
- Client returns `Stream` (or `Mailbox` with `asMailbox: true`)
- Backpressure via Ack protocol

### 6. Middleware Error Propagation

Middleware failure schemas are automatically unioned into each Rpc's error type:

```typescript
class Auth extends RpcMiddleware.Tag<Auth>()("Auth", {
  failure: AuthError
}) {}

const MyRpc = Rpc.make("MyRpc", { ... }).middleware(Auth)
// Rpc.Error<typeof MyRpc> includes AuthError
```

### 7. Dual Client/Server Middleware

When `requiredForClient: true`, middleware runs on both sides:

- **Server**: Standard middleware execution
- **Client**: `RpcMiddleware.layerClient(tag, fn)` — transforms the request before sending

### 8. Concurrency + Fork

Server `concurrency` limits parallel request handling. `Rpc.fork()` lets specific handlers opt out of the limit for high-priority or long-running requests.

---

## Quick Reference

### Import Patterns

```typescript
// Barrel
import {
  Rpc,
  RpcGroup,
  RpcServer,
  RpcClient,
  RpcMiddleware,
  RpcSerialization,
} from "@effect/rpc";

// Direct (tree-shakeable)
import * as RpcServer from "@effect/rpc/RpcServer";
```

### Typical Server Stack

```typescript
Layer.mergeAll(
  HandlersLive, // group.toLayer(...)
  MiddlewareLive // Layer.succeed(AuthMiddleware, ...)
).pipe(
  Layer.provide(
    RpcServer.layerHttpRouter({
      group,
      path: "/rpc",
    })
  ),
  Layer.provide(RpcSerialization.layerJson),
  Layer.provide(HttpLayerRouter.layer),
  Layer.provide(NodeHttpServer.layer({ port: 3000 }))
);
```

### Typical Client Stack

```typescript
RpcClient.make(group).pipe(
  Layer.provide(RpcClient.layerProtocolSocket()),
  Layer.provide(RpcSerialization.layerJson),
  Layer.provide(socketLayer)
);
```

### Serialization Decision Guide

| Scenario                  | Format                                     |
| ------------------------- | ------------------------------------------ |
| WebSocket / Socket        | `layerJson` (framing handled by transport) |
| HTTP streaming            | `layerNdjson` (self-framing)               |
| Binary data / performance | `layerMsgPack` (compact, binary-native)    |
| JSON-RPC compatibility    | `layerJsonRpc()` or `layerNdJsonRpc()`     |

### Protocol Feature Matrix

| Feature            | WebSocket    | HTTP | Socket       | Worker | Stdio |
| ------------------ | ------------ | ---- | ------------ | ------ | ----- |
| Ack (backpressure) | Yes          | No   | Yes          | Yes    | Yes   |
| Span propagation   | Yes          | No   | Yes          | Yes    | Yes   |
| Transferables      | No           | No   | No           | Yes    | No    |
| Ping/Pong          | Yes (client) | No   | Yes (client) | No     | No    |
| Multi-client       | Yes          | Yes  | Yes          | Yes    | No    |
