# Effect Platform — Deep Analysis

Comprehensive reference for `@effect/platform` (v0.94.2) — unified, platform-independent abstractions for HTTP, filesystem, terminal, workers, and more. Covers all 56 public modules, their service patterns, Layer composition, and architecture flows.

---

## Table of Contents

- [Package Overview](#package-overview)
- [Module Map](#module-map)
- [HTTP Client](#http-client)
- [HTTP Server](#http-server)
- [HTTP Router](#http-router)
- [Declarative HTTP API](#declarative-http-api)
- [HTTP Request & Response Types](#http-request--response-types)
- [HTTP Middleware](#http-middleware)
- [HTTP Core Components](#http-core-components)
- [FileSystem](#filesystem)
- [Terminal](#terminal)
- [KeyValueStore](#keyvaluestore)
- [Command & CommandExecutor](#command--commandexecutor)
- [Path](#path)
- [Socket & SocketServer](#socket--socketserver)
- [Worker & WorkerRunner](#worker--workerrunner)
- [Data Formats](#data-formats)
- [Platform Utilities](#platform-utilities)
- [Error Model](#error-model)
- [Key Patterns](#key-patterns)
- [Architecture Flows](#architecture-flows)
- [Quick Reference](#quick-reference)

---

## Package Overview

```
@effect/platform v0.94.2
"Unified interfaces for common platform-specific services"
```

**Purpose**: Platform-independent abstractions for Node.js, Bun, and browsers. Defines service interfaces — implementations live in downstream packages (`@effect/platform-node`, `@effect/platform-bun`, `@effect/platform-browser`).

### Dependencies

| Dependency       | Purpose                          |
| ---------------- | -------------------------------- |
| `find-my-way-ts` | Radix-tree HTTP router matching  |
| `msgpackr`       | MessagePack binary serialization |
| `multipasta`     | Multipart form data parsing      |
| `effect` (peer)  | Core Effect library              |

### Exports Pattern

```json
{
  ".": "./src/index.ts",
  "./*": "./src/*.ts",
  "./internal/*": null
}
```

- **Wildcard exports**: Every `src/*.ts` is importable as `@effect/platform/ModuleName`
- **Internal blocked**: `./internal/*` mapped to `null` — implementation files are private
- **Import convention**: `import { HttpClient } from "@effect/platform"` (barrel) or `import * as HttpClient from "@effect/platform/HttpClient"` (tree-shakeable)

### Module Organization

Each public module follows a consistent structure:

1. Type definitions & interfaces (in `src/ModuleName.ts`)
2. `TypeId` symbols for discriminated unions
3. Re-exports from `./internal/moduleName.js` (hidden implementation)

---

## Module Map

| Category          | Count  | Modules                                                                                                                  |
| ----------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| HTTP API          | 8      | HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiBuilder, HttpApiSchema, HttpApiScalar, HttpApiSecurity, HttpApiMiddleware |
| HTTP Server       | 7      | HttpServer, HttpServerRequest, HttpServerResponse, HttpServerError, HttpServerRespondable, HttpApp, HttpRouter           |
| HTTP Client       | 6      | HttpClient, HttpClientRequest, HttpClientResponse, HttpClientError, FetchHttpClient, HttpIncomingMessage                 |
| HTTP Core         | 8      | HttpMethod, HttpBody, Headers, Cookies, HttpPlatform, HttpTraceContext, Etag, HttpLayerRouter                            |
| HTTP Docs         | 4      | OpenApi, OpenApiJsonSchema, HttpApiSwagger, HttpApiClient                                                                |
| HTTP Composition  | 2      | HttpMiddleware, HttpMultiplex                                                                                            |
| Platform Services | 7      | FileSystem, Path, Terminal, KeyValueStore, PlatformConfigProvider, PlatformLogger, Runtime                               |
| Process/Workers   | 5      | Command, CommandExecutor, Worker, WorkerRunner, WorkerError                                                              |
| Data Formats      | 3      | MsgPack, Multipart, Ndjson                                                                                               |
| URLs & Web        | 3      | Url, UrlParams, ChannelSchema                                                                                            |
| Sockets           | 2      | Socket, SocketServer                                                                                                     |
| Utilities         | 4      | Effectify, Error, Template, Transferable                                                                                 |
| **Total**         | **56** |                                                                                                                          |

---

## HTTP Client

**Module**: `HttpClient.ts` — Service tag-based HTTP client with middleware pipeline.

### Service Tag

```typescript
import { HttpClient } from "@effect/platform";

// HttpClient is a Context.Tag
// execute: (request: HttpClientRequest) => Effect<HttpClientResponse, HttpClientError, R>
```

### Convenience Methods

HTTP verb shortcuts all return `Effect<HttpClientResponse, HttpClientError, HttpClient>`:

```typescript
HttpClient.get(url);
HttpClient.post(url);
HttpClient.put(url);
HttpClient.patch(url);
HttpClient.del(url);
HttpClient.head(url);
HttpClient.options(url);
```

### Request/Response Pipeline

```
HttpClientRequest
  → preprocess (validation/transformation)
  → execute (platform-specific fetch/http)
  → postprocess (response extraction)
  → HttpClientResponse
```

- `makeWith({ postprocess, preprocess })` — constructor combining both phases
- `make(handler)` — custom handler implementation via callback

### Client Middleware

```typescript
// Transform request before sending
HttpClient.mapRequest(client, f);
HttpClient.mapRequestEffect(client, f);

// Transform response after receiving
HttpClient.transformResponse(client, f);

// Full transform: access both request and effect
HttpClient.transform(client, f);
```

### Error Handling & Retry

```typescript
HttpClient.catchAll(client, handler);
HttpClient.catchTag(client, tag, handler);
HttpClient.filterStatus(client, range);
HttpClient.filterStatusOk(client); // only 2xx
HttpClient.retry(client, schedule);
HttpClient.retryTransient(client, schedule); // retry on transient failures
```

### Composition Features

```typescript
HttpClient.withCookiesRef(client, ref); // persist cookies across requests
HttpClient.followRedirects(client); // automatic redirect handling
HttpClient.withTracerPropagation(client, enabled); // distributed tracing
HttpClient.withSpanNameGenerator(client, fn); // custom span naming
```

### Fetch Implementation

```typescript
import { FetchHttpClient } from "@effect/platform";

// Layer providing HttpClient backed by browser/Node fetch
FetchHttpClient.layer;
```

---

## HTTP Server

**Module**: `HttpServer.ts` — Abstract HTTP server interface.

### Core Interface

```typescript
interface HttpServer {
  serve<E, R>(httpApp: App.Default<E, R>): Effect<void, never, R | Scope>;
  address: Address; // TcpAddress | UnixAddress
}
```

### Address Types

```typescript
type TcpAddress = { _tag: "TcpAddress"; hostname: string; port: number };
type UnixAddress = { _tag: "UnixAddress"; path: string };
```

### Serving Patterns

```typescript
// Layer-based serving (recommended)
HttpServer.serve();
HttpServer.serve(httpApp, middleware);

// Effect-based serving
HttpServer.serveEffect();
```

### Testing & Utilities

```typescript
HttpServer.addressWith(f); // run effect with server address
HttpServer.addressFormattedWith(f); // run with formatted address string
HttpServer.logAddress; // log server address on startup
HttpServer.layerTestClient; // HttpClient pointing to running server (tests)
HttpServer.layerContext; // provides HttpPlatform, FileSystem, Etag.Generator, Path
```

---

## HTTP Router

**Module**: `HttpRouter.ts` — Immutable, composable request router using `find-my-way-ts` radix tree.

### Router as App

```typescript
// HttpRouter<E, R> extends App.Default<E | RouteNotFound, R>
const router = HttpRouter.empty;
```

### Route Definition

```typescript
interface Route<E, R> {
  method: HttpMethod | "*";
  path: PathInput; // "/{param}" or "*" wildcard
  handler: Route.Handler<E, R>;
  prefix?: string;
  uninterruptible?: boolean;
}
```

### HTTP Verb Combinators

```typescript
HttpRouter.get(path, handler);
HttpRouter.post(path, handler);
HttpRouter.put(path, handler);
HttpRouter.patch(path, handler);
HttpRouter.del(path, handler);
HttpRouter.all(path, handler); // any method
```

### Composition

```typescript
HttpRouter.concat(router1, router2);
HttpRouter.mount(router, "/api", subRouter);
HttpRouter.mountApp(router, "/api", httpApp);
HttpRouter.prefixAll(router, "/v1");
```

### Route Context (Path Params)

```typescript
// RouteContext tag provides params: Record<string, string>
HttpRouter.params; // get path params
HttpRouter.schemaParams(schema); // validate path params via Schema
HttpRouter.schemaPathParams(schema);
HttpRouter.schemaJson(schema); // validate JSON body
HttpRouter.schemaNoBody(schema); // validate without body
```

### Custom Router Tags

```typescript
// Create named router with .Live, .router, .use, .unwrap, .serve
const MyRouter = HttpRouter.Tag<"MyRouter">();
const layer = MyRouter.router;

// Pre-defined default
HttpRouter.Default;
```

---

## Declarative HTTP API

**Modules**: `HttpApi.ts`, `HttpApiGroup.ts`, `HttpApiEndpoint.ts`, `HttpApiBuilder.ts`

The declarative API layer separates **definition** from **implementation** — define your API shape with schemas, then implement handlers separately.

### HttpApiEndpoint (Individual Endpoint)

```typescript
const getUser = HttpApiEndpoint.get("getUser", "/users/:id")
  .setPathParams(Schema.Struct({ id: Schema.NumberFromString }))
  .addSuccess(UserSchema)
  .addError(NotFoundError, { status: 404 })
  .setHeaders(Schema.Struct({ authorization: Schema.String }));
```

Properties:

- `name`, `path`, `method`
- `pathSchema`, `urlParamsSchema`, `payloadSchema`, `headersSchema`
- `successSchema`, `errorSchema`

### HttpApiGroup (Grouping Endpoints)

```typescript
const usersGroup = HttpApiGroup.make("users")
  .add(getUser)
  .add(createUser)
  .addError(AuthError, { status: 401 })
  .prefix("/api")
  .middleware(AuthMiddleware);
```

### HttpApi (Top-Level API)

```typescript
const api = HttpApi.make("MyAPI")
  .add(usersGroup)
  .add(postsGroup)
  .addError(ServerError)
  .middleware(LoggingMiddleware);
```

### HttpApiBuilder (Implementation)

```typescript
// Implement endpoints and serve
const layer = HttpApiBuilder.api(api).pipe(
  HttpServer.serve(HttpMiddleware.logger)
);

// Web standard handler for edge deployments
const handler = HttpApiBuilder.toWebHandler(api);
```

### Related Modules

| Module              | Purpose                                   |
| ------------------- | ----------------------------------------- |
| `HttpApiSchema`     | Schema handling for API endpoints         |
| `HttpApiScalar`     | Scalar type support                       |
| `HttpApiSecurity`   | Authentication/authorization definitions  |
| `HttpApiMiddleware` | Middleware for API groups/endpoints       |
| `HttpApiClient`     | Auto-generated client from API definition |
| `HttpApiSwagger`    | Swagger UI integration                    |
| `OpenApi`           | OpenAPI spec generation                   |
| `OpenApiJsonSchema` | JSON Schema for OpenAPI                   |

### Reflection

```typescript
// Extract metadata for code generation, docs, etc.
HttpApi.reflect(api, {
  onGroup: ({ group }) => ...,
  onEndpoint: ({ endpoint, successes, errors }) => ...,
})
```

---

## HTTP Request & Response Types

### HttpClientRequest

```typescript
interface HttpClientRequest {
  method: HttpMethod;
  url: string;
  urlParams: UrlParams;
  hash?: string;
  headers: Headers;
  body: HttpBody;
}
```

**Constructors** (typed — GET excludes body, POST excludes URL params):

```typescript
HttpClientRequest.get(url);
HttpClientRequest.post(url);
// ... all HTTP verbs
```

**Modification**:

```typescript
HttpClientRequest.setHeader(req, key, value);
HttpClientRequest.bearerToken(req, token);
HttpClientRequest.basicAuth(req, user, pass);
HttpClientRequest.bodyJson(req, data);
HttpClientRequest.bodyStream(req, stream);
HttpClientRequest.bodyFormData(req, formData);
```

### HttpClientResponse

```typescript
interface HttpClientResponse extends IncomingMessage<ResponseError> {
  request: HttpClientRequest;
  status: number;
  cookies: Cookies;
  formData: Effect<FormData, ResponseError>;
}
```

**Processing**:

```typescript
HttpClientResponse.matchStatus(response, {
  200: (r) => ...,
  404: (r) => ...,
  "4xx": (r) => ...,
})
HttpClientResponse.schemaJson(schema)(response)
HttpClientResponse.stream(response)  // Stream<Uint8Array>
```

### HttpServerRequest

```typescript
// Properties: source, url, originalUrl, method, cookies
// Body parsing:
HttpServerRequest.schemaBodyJson(schema);
HttpServerRequest.schemaBodyForm(schema);
HttpServerRequest.schemaBodyMultipart(schema);
// WebSocket:
HttpServerRequest.upgrade; // WebSocket upgrade
// Web standard:
HttpServerRequest.toWeb();
```

- `ParsedSearchParams` tag for query string access

### HttpServerResponse

**Constructors**:

```typescript
HttpServerResponse.empty();
HttpServerResponse.text("hello");
HttpServerResponse.json({ data: 42 });
HttpServerResponse.redirect("/other");
HttpServerResponse.html`<h1>Hello ${name}</h1>`; // template literal
HttpServerResponse.stream(byteStream);
HttpServerResponse.file(path);
HttpServerResponse.formData(data);
```

**Combinators**:

```typescript
HttpServerResponse.setHeader(res, key, value);
HttpServerResponse.setStatus(res, 201);
HttpServerResponse.setCookie(res, name, value);
HttpServerResponse.schemaJson(schema)(data);
```

---

## HTTP Middleware

**Module**: `HttpMiddleware.ts`

```typescript
type HttpMiddleware = <E, R>(self: App.Default<E, R>) => App.Default<any, any>;
```

### Built-in Middleware

```typescript
HttpMiddleware.logger; // request/response logging
HttpMiddleware.xForwardedHeaders; // X-Forwarded-* processing
HttpMiddleware.searchParamsParser; // automatic query parsing
HttpMiddleware.cors({
  // CORS
  allowedOrigins: ["https://example.com"], // or predicate
  allowedMethods: ["GET", "POST"],
  credentials: true,
  maxAge: Duration.hours(1),
});
```

### Tracer Configuration

```typescript
HttpMiddleware.withTracerDisabledWhen(predicate); // disable per-request
HttpMiddleware.withTracerDisabledForUrls(patterns); // disable for URL patterns
HttpMiddleware.withSpanNameGenerator(fn); // custom span naming
```

### Fiber References

```typescript
// Toggle per-fiber via Effect.locally()
HttpMiddleware.loggerDisabled;
HttpMiddleware.currentTracerDisabledWhen;
```

---

## HTTP Core Components

| Module             | Purpose                                                         |
| ------------------ | --------------------------------------------------------------- |
| `HttpMethod`       | HTTP method types (`GET`, `POST`, etc.) and guards              |
| `HttpBody`         | Request/response body encoding (JSON, text, stream, form, file) |
| `Headers`          | HTTP headers utilities (get, set, merge, schema validation)     |
| `Cookies`          | Cookie parsing, serialization, `CookiesRef` for state           |
| `HttpPlatform`     | Platform-specific HTTP abstractions                             |
| `HttpTraceContext` | W3C trace context propagation for distributed tracing           |
| `Etag`             | Entity tag generation and comparison                            |
| `HttpLayerRouter`  | Router exposed as a Layer for composition                       |
| `HttpMultiplex`    | Request multiplexing across multiple apps                       |

---

## FileSystem

**Module**: `FileSystem.ts` — Abstract filesystem operations.

### Service Tag

```typescript
Context.GenericTag<FileSystem>("@effect/platform/FileSystem");
```

### Core Operations

```typescript
FileSystem.readFile(path)              // Effect<Uint8Array, PlatformError>
FileSystem.writeFile(path, data)       // Effect<void, PlatformError>
FileSystem.readFileString(path)        // Effect<string, PlatformError>
FileSystem.writeFileString(path, str)  // Effect<void, PlatformError>
FileSystem.exists(path)                // Effect<boolean, PlatformError>
FileSystem.remove(path)                // Effect<void, PlatformError>
FileSystem.copy(src, dst)              // Effect<void, PlatformError>
FileSystem.rename(old, new)            // Effect<void, PlatformError>
```

### Directory Operations

```typescript
FileSystem.readDirectory(path); // Effect<Array<string>>
FileSystem.makeDirectory(path); // Effect<void>
FileSystem.makeTempDirectory(); // Effect<string>
FileSystem.makeTempDirectoryScoped(); // Effect<string, _, Scope>
```

### Stream-based I/O

```typescript
FileSystem.stream(path); // Stream<Uint8Array>
FileSystem.sink(path); // Sink<void, Uint8Array>
FileSystem.watch(path); // Stream<WatchEvent>  (Create | Update | Remove)
```

### File Interface

```typescript
interface File {
  read(buf): Effect<Size>;
  write(buf): Effect<Size>;
  readAlloc(size): Effect<Option<Uint8Array>>;
  writeAll(buf): Effect<void>;
  seek(offset, whence): Effect<void>;
  stat: Effect<File.Info>;
  sync: Effect<void>;
  truncate(length?): Effect<void>;
}
```

### Branded Types

```typescript
type Size = bigint & Brand<"Size">;
// Unit helpers: Size.KiB, Size.MiB, Size.GiB, Size.TiB, Size.PiB

type FileDescriptor = number & Brand<"FileDescriptor">;
```

### Layers

```typescript
FileSystem.layerNoop(impl); // testing layer
// Platform implementations: @effect/platform-node, @effect/platform-bun
```

---

## Terminal

**Module**: `Terminal.ts` — Terminal/console access.

### Service Tag

```typescript
Context.GenericTag<Terminal>("@effect/platform/Terminal");
```

### Key Functions

```typescript
Terminal.columns; // Effect<number>  — terminal width
Terminal.rows; // Effect<number>  — terminal height
Terminal.isTTY; // Effect<boolean> — interactive check
Terminal.readLine; // Effect<string, QuitException>
Terminal.readInput; // Effect<ReadonlyMailbox<UserInput>, never, Scope>
Terminal.display(text); // Effect<void, PlatformError>
```

### Types

```typescript
interface Key { name: string; ctrl: boolean; meta: boolean; shift: boolean }
interface UserInput { input: Option<string>; key: Key }
class QuitException  // Ctrl+C
```

---

## KeyValueStore

**Module**: `KeyValueStore.ts` — Simple key-value storage abstraction.

### Service Tag

```typescript
Context.GenericTag<KeyValueStore>("@effect/platform/KeyValueStore");
```

### Core API

```typescript
KeyValueStore.get(key); // Effect<Option<string>>
KeyValueStore.getUint8Array(key); // Effect<Option<Uint8Array>>
KeyValueStore.set(key, value); // Effect<void>
KeyValueStore.remove(key); // Effect<void>
KeyValueStore.clear(); // Effect<void>
KeyValueStore.size; // Effect<number>
KeyValueStore.has(key); // Effect<boolean>
KeyValueStore.modify(key, f); // update if exists
KeyValueStore.forSchema(schema); // SchemaStore<A, R>
```

### SchemaStore (Typed Variant)

```typescript
const store = KeyValueStore.forSchema(UserSchema);
store.get(key); // Effect<Option<User>, ParseError | PlatformError>
store.set(key, user);
```

### Layers

```typescript
KeyValueStore.layerMemory; // in-memory Map
KeyValueStore.layerFileSystem(directory); // file-based (requires FileSystem + Path)
KeyValueStore.layerStorage(evaluate); // Web Storage API wrapper
KeyValueStore.layerSchema(schema, tagId); // tagged layer for typed store
```

### Composition

```typescript
KeyValueStore.prefix(store, "myapp:"); // prefixed view
KeyValueStore.make(impl); // fill derived methods from primitives
KeyValueStore.makeStringOnly(impl); // base64 encoding for binary in string-only backends
```

---

## Command & CommandExecutor

**Modules**: `Command.ts`, `CommandExecutor.ts` — Process execution.

### Command (Functional Builder)

```typescript
// No service tag — pure builder pattern
const cmd = Command.make("git", "status")
  |> Command.workingDirectory("/repo")
  |> Command.env({ NODE_ENV: "production" })
  |> Command.stdin("pipe")
  |> Command.stdout("pipe")
  |> Command.runInShell("/bin/bash")

// Pipe commands together
const piped = Command.pipeTo(
  Command.make("cat", "file.txt"),
  Command.make("grep", "pattern")
)
```

### CommandExecutor (Service)

```typescript
Context.Tag<CommandExecutor, CommandExecutor>;

CommandExecutor.exitCode(cmd); // Effect<ExitCode>
CommandExecutor.start(cmd); // Effect<Process, PlatformError, Scope>
CommandExecutor.string(cmd); // Effect<string>
CommandExecutor.lines(cmd); // Effect<Array<string>>
CommandExecutor.stream(cmd); // Stream<Uint8Array>
CommandExecutor.streamLines(cmd); // Stream<string>
```

### Process Interface

```typescript
interface Process {
  pid: ProcessId; // branded number
  exitCode: Effect<ExitCode>; // branded number
  isRunning: Effect<boolean>;
  kill(signal?: Signal): Effect<void>; // POSIX signals
  stdout: Stream<Uint8Array>;
  stderr: Stream<Uint8Array>;
  stdin: Sink<void, Uint8Array>;
}
```

---

## Path

**Module**: `Path.ts` — Cross-platform path utilities.

### Service Tag

```typescript
Context.Tag<Path, Path>;
```

### Key Functions

```typescript
Path.sep                            // path separator
Path.join(...paths)                 // join segments
Path.resolve(...segments)           // resolve to absolute
Path.basename(path, suffix?)        // filename
Path.dirname(path)                  // directory
Path.extname(path)                  // extension
Path.normalize(path)
Path.relative(from, to)
Path.isAbsolute(path)
Path.parse(path)                    // { root, dir, base, ext, name }
Path.format(parsed)                 // reconstruct
Path.toFileUrl(path)                // Effect<URL, BadArgument>
Path.fromFileUrl(url)               // Effect<string, BadArgument>
```

---

## Socket & SocketServer

**Module**: `Socket.ts` — Low-level socket operations with WebSocket support.

### Socket Service

```typescript
Context.GenericTag<Socket>("@effect/platform/Socket")

Socket.run(handler, options?)       // process binary data
Socket.runRaw(handler, options?)    // process string or binary
Socket.writer                       // Effect<write fn, never, Scope>
```

### Channel Conversion

```typescript
Socket.toChannel(); // Channel<Chunk<Uint8Array>, ...>
Socket.toChannelString(); // string channel
Socket.toChannelMap(f); // mapped channel
```

### WebSocket Support

```typescript
Socket.makeWebSocket(url, options); // Socket from WebSocket URL
Socket.fromWebSocket(acquire, options); // Socket from WebSocket instance
Socket.fromTransformStream(stream); // Socket from ReadableStream/WritableStream
```

### Error Types

```typescript
type SocketError = SocketGenericError | SocketCloseError;
// SocketGenericError: reason "Write" | "Read" | "Open" | "OpenTimeout"
// SocketCloseError: code + closeReason
```

### SocketServer

```typescript
interface SocketServer {
  address: Address; // TcpAddress | UnixAddress
  run<E, R>(
    handler: (socket: Socket) => Effect<_, E, R>
  ): Effect<never, SocketServerError, R>;
}
```

---

## Worker & WorkerRunner

**Modules**: `Worker.ts`, `WorkerRunner.ts` — Worker thread abstraction with pool management.

### Worker Service Tags

```typescript
PlatformWorker; // backend spawner
WorkerManager; // pools and spawns workers
Spawner; // worker factory function
```

### Worker Operations

```typescript
Worker.execute(message); // Stream<O, E | WorkerError>  — streaming response
Worker.executeEffect(message); // Effect<O, E | WorkerError>  — single response
```

### Worker Pools

```typescript
Worker.makePool({
  size: 4, // or minSize/maxSize for elastic
  concurrency: 10,
  targetUtilization: 0.8,
  timeToLive: Duration.minutes(5),
});
```

### WorkerRunner (Server Side)

```typescript
PlatformRunner; // message-based worker server

WorkerRunner.make(process, options); // raw handler
WorkerRunner.makeSerialized(schema, handlers); // schema-based dispatch
WorkerRunner.launch(layer); // launch with close latch
```

### Message Protocol

```typescript
// Wire format: [id, type, data | cause, optional trace]
type BackingWorker<I, O> = { send(message): Effect; run(handler): Effect };
```

---

## Data Formats

| Module      | Purpose                          | Dependency   |
| ----------- | -------------------------------- | ------------ |
| `MsgPack`   | MessagePack binary codec         | `msgpackr`   |
| `Multipart` | Multipart form data handling     | `multipasta` |
| `Ndjson`    | Newline-delimited JSON streaming | —            |

---

## Platform Utilities

| Module                   | Purpose                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `PlatformConfigProvider` | ConfigProvider from file trees (`fromFileTree`) or `.env` files (`fromDotEnv`)         |
| `PlatformLogger`         | File-based logger via `toFile(path, options)` — requires FileSystem                    |
| `Runtime`                | Runtime environment utilities                                                          |
| `Effectify`              | Convert Node.js-style callbacks to Effect                                              |
| `Template`               | Template string utilities                                                              |
| `Transferable`           | Collect `Transferable` objects for worker `postMessage` — optional `Collector` service |
| `Url`                    | URL parsing and manipulation                                                           |
| `UrlParams`              | Query parameter utilities                                                              |
| `ChannelSchema`          | Schema for channel-based communication                                                 |

### PlatformConfigProvider Layers

```typescript
PlatformConfigProvider.layerFileTree(options?)     // directory tree as config
PlatformConfigProvider.layerDotEnv(path)           // .env file as config
PlatformConfigProvider.layerFileTreeAdd             // merge with existing
PlatformConfigProvider.layerDotEnvAdd               // merge with existing
```

### Transferable Pattern

```typescript
// Optional service — gracefully degrades if not provided
Transferable.Collector; // Tag<Collector, CollectorService>
Transferable.addAll(transferables);
Transferable.schema(self, f); // wrap schema to collect on encode

// Pre-built schemas
Transferable.ImageData;
Transferable.MessagePort;
Transferable.Uint8Array;
```

---

## Error Model

**Module**: `Error.ts`

### Error Types

```typescript
type PlatformError = BadArgument | SystemError

// BadArgument: invalid parameters
interface BadArgument {
  _tag: "BadArgument"
  module: string    // "FileSystem", "Command", etc.
  method: string
  message: string
}

// SystemError: OS-level failures
interface SystemError {
  _tag: "SystemError"
  reason: "AlreadyExists" | "NotFound" | "Busy" | "PermissionDenied" | ...
  module: string
  method: string
  syscall: string
  pathOrDescriptor: string | FileDescriptor
}
```

### Worker Errors

```typescript
class WorkerError extends Schema.TaggedError<WorkerError>() {
  reason: "spawn" | "decode" | "send" | "unknown" | "encode";
}
```

All platform errors are serializable via Schema.

---

## Key Patterns

### 1. Service Tags via Context

Every capability is an abstract service accessed through `Context.Tag`:

```typescript
// Two tag forms used across the package:
Context.GenericTag<FileSystem>("@effect/platform/FileSystem"); // simpler
Context.Tag<CommandExecutor, CommandExecutor>; // standard
```

### 2. Layer Provision

Services ship with layer constructors — pick the implementation for your platform:

```typescript
// In-memory for tests
KeyValueStore.layerMemory;

// Platform-specific (from @effect/platform-node)
NodeFileSystem.layer;
NodeTerminal.layer;
NodeHttpServer.layer({ port: 3000 });
```

### 3. make() Constructor Pattern

Most services have a `make(impl)` that fills in derived methods from primitives:

```typescript
// Only implement the core methods, derived ones (has, isEmpty, modify) are auto-generated
const store = KeyValueStore.make({
  get: (key) => ...,
  set: (key, value) => ...,
  remove: (key) => ...,
  clear: ...,
  size: ...,
})
```

### 4. Branded Types

Type-safe wrappers prevent mixing up raw primitives:

```typescript
type Size = bigint & Brand<"Size">;
type ProcessId = number & Brand<"ProcessId">;
type ExitCode = number & Brand<"ExitCode">;
type FileDescriptor = number & Brand<"FileDescriptor">;
```

### 5. Schema Integration

Deep integration with `@effect/schema` for validation, serialization, and documentation:

- HTTP API endpoints use Schema for path params, body, headers, response
- KeyValueStore has `forSchema()` for typed access
- Worker messages use `Schema.TaggedRequest` for dispatch
- Transferable uses Schema transforms for collection

### 6. Dual API

Many functions support both data-first and data-last calling:

```typescript
// data-first
HttpClient.mapRequest(client, f);

// data-last (pipeable)
client.pipe(HttpClient.mapRequest(f));
```

### 7. Scope for Resource Management

File handles, server connections, and processes use `Scope` for automatic cleanup:

```typescript
// Process requires Scope — automatically killed when scope closes
CommandExecutor.start(cmd); // Effect<Process, PlatformError, Scope>

// Temp directories cleaned up with scope
FileSystem.makeTempDirectoryScoped(); // Effect<string, PlatformError, Scope>
```

### 8. Stream/Sink for I/O

Readable operations return `Stream`, writable operations return `Sink`:

```typescript
FileSystem.stream(path); // Stream<Uint8Array>
FileSystem.sink(path); // Sink<void, Uint8Array>
Process.stdout; // Stream<Uint8Array>
Process.stdin; // Sink<void, Uint8Array>
```

### 9. Optional Services

Some services gracefully degrade when not provided:

```typescript
// Transferable.Collector checks serviceOption — no-ops if absent
Transferable.addAll(items); // safe to call without Collector in context
```

---

## Architecture Flows

### Client Request Pipeline

```
HttpClientRequest.post(url)
  |> HttpClientRequest.bearerToken(token)
  |> HttpClientRequest.bodyJson(data)
  → HttpClient.preprocess (validation/transformation)
  → HttpClient.execute (platform fetch)
  → HttpClient.postprocess (response extraction)
  → HttpClientResponse
  → HttpClientResponse.schemaJson(ResponseSchema)
  → typed response data
```

### Server Routing Flow

```
Incoming HTTP request
  → HttpServerRequest (platform-specific source wrapped)
  → HttpMiddleware.logger (logging)
  → HttpRouter (find-my-way-ts radix tree match)
  → RouteContext { params: Record<string, string> }
  → Route.Handler (endpoint logic)
  → HttpServerResponse.json(data)
  → HttpMiddleware.cors (CORS headers)
  → Response sent
```

### Declarative API Flow

```
1. DEFINE (pure data):
   HttpApiEndpoint.get("getUser", "/users/:id")
     → HttpApiGroup.make("users").add(endpoint)
     → HttpApi.make("MyAPI").add(group)

2. IMPLEMENT (effectful layers):
   HttpApiBuilder.api(api)
     → generates HttpRouter from endpoint definitions
     → validates path params, body, headers via Schema
     → routes to handler implementations

3. SERVE:
   HttpApiBuilder.api(api)
     .pipe(HttpServer.serve(HttpMiddleware.logger))
     → Layer<never, HttpServerError, HttpServer.HttpServer>

4. GENERATE (optional):
   HttpApiClient.make(api)        → type-safe client
   OpenApi.fromApi(api)           → OpenAPI spec
   HttpApiSwagger.layer           → Swagger UI
```

### Layer Composition for Server

```typescript
const ServerLive = HttpApiBuilder.api(api).pipe(
  Layer.provide(HandlerLayers), // endpoint implementations
  HttpServer.serve(HttpMiddleware.logger),
  Layer.provide(NodeHttpServer.layer({ port: 3000 })),
  Layer.provide(NodeHttpPlatform.layer)
);

// Run
Layer.launch(ServerLive);
```

---

## Quick Reference

### Import Patterns

```typescript
// Barrel import (most common)
import { HttpClient, HttpServer, FileSystem } from "@effect/platform";

// Direct module import (tree-shakeable)
import * as HttpClient from "@effect/platform/HttpClient";

// Platform implementation
import { NodeHttpServer } from "@effect/platform-node";
```

### Common Layer Stack

```typescript
// Typical Node.js server
Layer.mergeAll(
  NodeHttpServer.layer({ port: 3000 }),
  NodeFileSystem.layer,
  NodeTerminal.layer,
  NodeHttpPlatform.layer
);
```

### Module Count by Category

| Category               | Modules |
| ---------------------- | ------- |
| HTTP API & Docs        | 12      |
| HTTP Server & Routing  | 9       |
| HTTP Client            | 6       |
| HTTP Core & Middleware | 10      |
| Platform Services      | 7       |
| Process/Workers        | 5       |
| Data Formats           | 3       |
| URLs & Web             | 3       |
| Sockets                | 2       |
| Utilities              | 4       |
| **Total Public**       | **~56** |
