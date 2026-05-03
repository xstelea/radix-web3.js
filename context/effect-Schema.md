# Effect Schema Reference

Comprehensive reference for Effect's Schema module - a powerful runtime validation and transformation library with full TypeScript type inference.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Built-in Schemas](#built-in-schemas)
3. [Combinators Reference](#combinators-reference)
4. [Decoding & Encoding](#decoding--encoding)
5. [Common Patterns](#common-patterns)
6. [Effect Integration](#effect-integration)
7. [Quick Reference](#quick-reference)

---

## Core Concepts

### The Schema Type Signature

```typescript
interface Schema<in out A, in out I = A, out R = never> {
  readonly Type: A; // The decoded/validated type (what you work with)
  readonly Encoded: I; // The encoded type (what comes from external sources)
  readonly Context: R; // Effect context requirements (services/dependencies)
  readonly ast: AST.AST; // The abstract syntax tree representation
}
```

**Type Parameters Explained:**

| Parameter     | Meaning                                  | Example                         |
| ------------- | ---------------------------------------- | ------------------------------- |
| `A` (Type)    | The "rich" type after decoding           | `Date`, `number`, branded types |
| `I` (Encoded) | The "wire" format for serialization      | `string`, JSON-compatible data  |
| `R` (Context) | Effect dependencies for async validation | `never` for pure schemas        |

### Encoding vs Decoding Flow

```
External Data (I) ──decode──> Internal Type (A)
                  <──encode──
```

- **Decoding**: Parse/validate external input (JSON, form data, API responses)
- **Encoding**: Serialize for transport (to JSON, to API requests)

### When to Use Schema vs Manual Validation

| Use Schema When                    | Use Manual Validation When     |
| ---------------------------------- | ------------------------------ |
| Parsing external API data          | Simple null checks             |
| Form validation with complex rules | Single field validation        |
| Serialization/deserialization      | Performance-critical hot paths |
| Type-safe branded types            | Already validated data         |
| Discriminated union parsing        |                                |

### AST Overview

Every schema has an AST (Abstract Syntax Tree) that describes its structure:

```typescript
type AST =
  | Literal
  | UniqueSymbol
  | UndefinedKeyword
  | VoidKeyword
  | NeverKeyword
  | UnknownKeyword
  | AnyKeyword
  | StringKeyword
  | NumberKeyword
  | BooleanKeyword
  | BigIntKeyword
  | SymbolKeyword
  | ObjectKeyword
  | Enums
  | TemplateLiteral
  | Refinement
  | TupleType
  | TypeLiteral
  | Union
  | Suspend
  | Transformation
  | Declaration;
```

---

## Built-in Schemas

### Primitive Types

```typescript
import { Schema as S } from "effect";

// Basic primitives
S.String; // Schema<string>
S.Number; // Schema<number>
S.Boolean; // Schema<boolean>
S.BigIntFromSelf; // Schema<bigint>
S.SymbolFromSelf; // Schema<symbol>

// Special types
S.Null; // Schema<null>
S.Undefined; // Schema<undefined>
S.Void; // Schema<void>
S.Unknown; // Schema<unknown>
S.Any; // Schema<any>
S.Never; // Schema<never>
S.Object; // Schema<object>
```

### String Variants

```typescript
// Validated string types
S.NonEmptyString; // non-empty string
S.Trimmed; // no leading/trailing whitespace
S.NonEmptyTrimmedString;
S.Lowercased; // all lowercase
S.Uppercased; // all uppercase
S.Capitalized; // first char uppercase
S.Char; // single character

// Common formats
S.UUID; // UUID format
S.ULID; // ULID format
S.URL; // Schema<URL, string> - transforms string to URL object

// Transforming schemas
S.Trim; // trims whitespace
S.Lowercase; // converts to lowercase
S.Uppercase; // converts to uppercase
S.Capitalize; // capitalizes first char
```

### Number Variants

```typescript
// Validated number types
S.Int; // integer (safe integer)
S.Finite; // excludes Infinity/-Infinity
S.NonNaN; // excludes NaN
S.Positive; // > 0
S.Negative; // < 0
S.NonPositive; // <= 0
S.NonNegative; // >= 0
S.Uint8; // 0-255

// Transformation
S.NumberFromString; // Schema<number, string> - parses string to number
```

### BigInt Variants

```typescript
S.BigIntFromSelf; // Schema<bigint>
S.BigInt; // Schema<bigint, string> - from string
S.BigIntFromNumber; // Schema<bigint, number> - from number
S.NonNegativeBigIntFromSelf;
S.NonPositiveBigIntFromSelf;
S.PositiveBigIntFromSelf;
S.NegativeBigIntFromSelf;
```

### Collections

```typescript
// Arrays
S.Array(S.String); // Schema<string[]>
S.NonEmptyArray(S.Number); // Schema<[number, ...number[]]>

// Tuples
S.Tuple(S.String, S.Number); // Schema<readonly [string, number]>
S.Tuple(S.String, S.Number, S.Boolean);

// With optional elements
S.Tuple(S.String, S.optionalElement(S.Number));

// With rest elements
S.Tuple([S.String, S.Number], S.Boolean); // [string, number, ...boolean[]]

// Records
S.Record({ key: S.String, value: S.Number });
// Schema<{ [x: string]: number }>
```

### Struct (Object Schemas)

```typescript
const User = S.Struct({
  id: S.Number,
  name: S.String,
  email: S.String,
});
// Schema<{ readonly id: number; readonly name: string; readonly email: string }>

// With optional fields
const UserWithOptional = S.Struct({
  id: S.Number,
  name: S.String,
  nickname: S.optional(S.String), // optional, allows undefined
  bio: S.optionalWith(S.String, { exact: true }), // optional, no undefined
});
```

### Effect Types

```typescript
// Option
S.OptionFromSelf(S.String); // Schema<Option<string>>
S.Option(S.String); // Schema<Option<string>, { _tag: "None" } | { _tag: "Some", value: string }>
S.OptionFromNullOr(S.String); // Schema<Option<string>, string | null>
S.OptionFromUndefinedOr(S.String);

// Either
S.EitherFromSelf({ left: S.String, right: S.Number });
S.Either({ left: S.String, right: S.Number });

// Cause (for error representation)
S.CauseFromSelf({ error: S.String, defect: S.Defect });
S.Cause({ error: S.String });

// Exit (success or failure)
S.ExitFromSelf({ success: S.Number, failure: S.String, defect: S.Defect });
S.Exit({ success: S.Number, failure: S.String });

// Duration
S.DurationFromSelf; // Schema<Duration>
S.Duration; // Schema<Duration, DurationEncoded>
S.DurationFromMillis; // Schema<Duration, number>
S.DurationFromNanos; // Schema<Duration, bigint>

// DateTime
S.DateTimeUtcFromSelf; // Schema<DateTime.Utc>
S.DateTimeUtc; // Schema<DateTime.Utc, string> - from ISO string
S.DateTimeUtcFromNumber; // Schema<DateTime.Utc, number> - from timestamp
S.DateTimeZoned; // with timezone
```

### Binary Data

```typescript
// Uint8Array
S.Uint8ArrayFromSelf; // Schema<Uint8Array>
S.Uint8Array; // Schema<Uint8Array, number[]>
S.Uint8ArrayFromBase64; // Schema<Uint8Array, string> - base64 encoded
S.Uint8ArrayFromBase64Url; // URL-safe base64
S.Uint8ArrayFromHex; // hex encoded

// String encodings
S.StringFromBase64; // Schema<string, string>
S.StringFromBase64Url;
S.StringFromHex;
```

---

## Combinators Reference

### Union & Discrimination

```typescript
// Simple union
const StringOrNumber = S.Union(S.String, S.Number);
// Schema<string | number>

// Nullable types
S.NullOr(S.String); // Schema<string | null>
S.UndefinedOr(S.String); // Schema<string | undefined>
S.NullishOr(S.String); // Schema<string | null | undefined>

// Literal values
S.Literal("a"); // Schema<"a">
S.Literal("a", "b", "c"); // Schema<"a" | "b" | "c">
S.Literal(1, 2, 3); // Schema<1 | 2 | 3>

// TypeScript enums
enum Status {
  Active = "active",
  Inactive = "inactive",
}
S.Enums(Status); // Schema<Status>

// Discriminated unions (recommended for complex unions)
const Shape = S.Union(
  S.Struct({ _tag: S.Literal("Circle"), radius: S.Number }),
  S.Struct({ _tag: S.Literal("Square"), side: S.Number })
);
```

### Property Signatures

```typescript
// Basic property signature
S.propertySignature(S.String);

// Optional fields
S.optional(S.String); // type: T | undefined, encoded: T | undefined
S.optionalWith(S.String, { exact: true }); // type: T, encoded: T (truly optional)

// With defaults
S.optionalWith(S.Number, { default: () => 0 }); // provides default on decode
S.optionalWith(S.String, {
  default: () => "default", // decode default
  as: "Option", // wraps in Option
});

// Nullable handling
S.optionalWith(S.String, { nullable: true }); // accepts null

// Constructor defaults (for Class schemas)
S.propertySignature(S.String).pipe(S.withConstructorDefault(() => "default"));

// Decoding defaults (applied during decode)
S.optional(S.Number).pipe(S.withDecodingDefault(() => 0));

// Both defaults
S.optional(S.Number).pipe(
  S.withDefaults({ constructor: () => 0, decoding: () => 0 })
);
```

### Struct Operations

```typescript
const User = S.Struct({
  id: S.Number,
  name: S.String,
  email: S.String,
  age: S.Number,
});

// Pick specific fields
const UserName = User.pipe(S.pick("name", "email"));
// Or: User.pick("name", "email")

// Omit specific fields
const UserWithoutId = User.pipe(S.omit("id"));
// Or: User.omit("id")

// Make all fields optional
const PartialUser = S.partial(User);
// { id?: number | undefined, name?: string | undefined, ... }

// Exact partial (no undefined)
const ExactPartialUser = S.partialWith(User, { exact: true });
// { id?: number, name?: string, ... }

// Make all fields required
const RequiredUser = S.required(PartialUser);

// Make all fields mutable (remove readonly)
const MutableUser = S.mutable(User);

// Extend a struct
const ExtendedUser = User.pipe(S.extend(S.Struct({ role: S.String })));

// Rename fields
const RenamedUser = User.pipe(S.rename({ name: "fullName" }));

// Pluck a single field (transform struct to field value)
const JustName = User.pipe(S.pluck("name"));
// Schema<string, { readonly name: string }>
```

### Transforms

```typescript
// Pure transformation (no failure possible)
const DateFromString = S.transform(
  S.String, // from
  S.DateFromSelf, // to
  {
    strict: true,
    decode: (s) => new Date(s),
    encode: (d) => d.toISOString(),
  }
);

// Transformation with validation (can fail)
const SafeDateFromString = S.transformOrFail(S.String, S.DateFromSelf, {
  strict: true,
  decode: (s, _, ast) => {
    const d = new Date(s);
    return isNaN(d.getTime())
      ? ParseResult.fail(new ParseResult.Type(ast, s, "Invalid date"))
      : ParseResult.succeed(d);
  },
  encode: (d) => ParseResult.succeed(d.toISOString()),
});

// Compose two schemas (chain transformations)
const NumberFromJson = S.compose(S.parseJson(), S.Number);
// Schema<number, string> - parse JSON then validate as number

// Transform literals
S.transformLiteral(0, false); // 0 -> false
S.transformLiteral("yes", true);

// Transform multiple literals
S.transformLiterals([0, "zero"], [1, "one"], [2, "two"]);
```

### Refinements & Filters

```typescript
// Basic filter (predicate)
const PositiveNumber = S.Number.pipe(S.filter((n) => n > 0));

// Filter with custom message
const Adult = S.Number.pipe(
  S.filter((age) => age >= 18, {
    message: () => "Must be 18 or older",
  })
);

// Multiple issues
const ValidUsername = S.String.pipe(
  S.filter((s) => {
    const issues: S.FilterIssue[] = [];
    if (s.length < 3) issues.push({ path: [], message: "Too short" });
    if (!/^[a-z]/.test(s))
      issues.push({ path: [], message: "Must start with lowercase" });
    return issues.length === 0 ? true : issues;
  })
);

// String filters
S.String.pipe(S.minLength(1));
S.String.pipe(S.maxLength(100));
S.String.pipe(S.length(10)); // exact length
S.String.pipe(S.length({ min: 5, max: 10 }));
S.String.pipe(S.pattern(/^[A-Z]/)); // regex pattern
S.String.pipe(S.startsWith("prefix"));
S.String.pipe(S.endsWith("suffix"));
S.String.pipe(S.includes("substring"));
S.String.pipe(S.trimmed()); // validates (not transforms)
S.String.pipe(S.lowercased());
S.String.pipe(S.uppercased());
S.String.pipe(S.nonEmptyString());

// Number filters
S.Number.pipe(S.int());
S.Number.pipe(S.finite());
S.Number.pipe(S.positive());
S.Number.pipe(S.negative());
S.Number.pipe(S.nonPositive());
S.Number.pipe(S.nonNegative());
S.Number.pipe(S.nonNaN());
S.Number.pipe(S.greaterThan(0));
S.Number.pipe(S.greaterThanOrEqualTo(0));
S.Number.pipe(S.lessThan(100));
S.Number.pipe(S.lessThanOrEqualTo(100));
S.Number.pipe(S.between(0, 100));
S.Number.pipe(S.multipleOf(5));

// Clamp transformation
S.Number.pipe(S.clamp(0, 100)); // clamps values to range

// Array filters
S.Array(S.String).pipe(S.minItems(1));
S.Array(S.String).pipe(S.maxItems(10));
S.Array(S.String).pipe(S.itemsCount(5));
```

### Branded Types

```typescript
// Simple brand
const UserId = S.Number.pipe(S.brand("UserId"));
type UserId = S.Schema.Type<typeof UserId>;
// number & Brand<"UserId">

// Brand with validation
const Email = S.String.pipe(
  S.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  S.brand("Email")
);
type Email = S.Schema.Type<typeof Email>;

// Using branded values
const myId: UserId = UserId.make(123);

// Brand from Brand module
import { Brand } from "effect";
type PositiveInt = number & Brand.Brand<"PositiveInt">;
const PositiveInt = Brand.refined<PositiveInt>(
  (n) => Number.isInteger(n) && n > 0,
  (n) => Brand.error(`Expected positive integer, got ${n}`)
);

const PositiveIntSchema = S.Number.pipe(S.fromBrand(PositiveInt));
```

### Recursive Schemas

```typescript
// Use suspend for recursive types
interface Category {
  readonly name: string;
  readonly subcategories: readonly Category[];
}

const Category: S.Schema<Category> = S.Struct({
  name: S.String,
  subcategories: S.Array(S.suspend(() => Category)),
});

// For mutually recursive types
interface Node {
  value: number;
  children: readonly Tree[];
}
interface Tree {
  root: Node;
}

const Node: S.Schema<Node> = S.suspend(() =>
  S.Struct({
    value: S.Number,
    children: S.Array(Tree),
  })
);
const Tree: S.Schema<Tree> = S.Struct({
  root: Node,
});
```

### Field Renaming

```typescript
// Rename during encoding (fromKey)
const ApiUser = S.Struct({
  id: S.Number,
  fullName: S.propertySignature(S.String).pipe(S.fromKey("full_name")),
  emailAddress: S.propertySignature(S.String).pipe(S.fromKey("email_address")),
});
// Type: { id: number, fullName: string, emailAddress: string }
// Encoded: { id: number, full_name: string, email_address: string }

// Bulk rename
const RenamedUser = User.pipe(
  S.rename({
    name: "fullName",
    email: "emailAddress",
  })
);
```

### Attach Property Signature

```typescript
// Add discriminant to simple schemas
const Circle = S.Struct({ radius: S.Number }).pipe(
  S.attachPropertySignature("kind", "circle")
);
const Square = S.Struct({ side: S.Number }).pipe(
  S.attachPropertySignature("kind", "square")
);

const Shape = S.Union(Circle, Square);
// Decode { radius: 10 } -> { kind: "circle", radius: 10 }
```

---

## Decoding & Encoding

### API Variants

| Function        | Return Type                | Throws         | Effect Context |
| --------------- | -------------------------- | -------------- | -------------- |
| `decodeSync`    | `A`                        | Yes            | No             |
| `decodeOption`  | `Option<A>`                | No             | No             |
| `decodeEither`  | `Either<A, ParseError>`    | No             | No             |
| `decodePromise` | `Promise<A>`               | Yes (rejected) | No             |
| `decode`        | `Effect<A, ParseError, R>` | No             | Yes            |

```typescript
const User = S.Struct({ name: S.String, age: S.Number });

// Synchronous (throws on error)
const user = S.decodeSync(User)({ name: "Alice", age: 30 });

// Synchronous with Either
const result = S.decodeEither(User)({ name: "Alice", age: 30 });
// Either<{ name: string; age: number }, ParseError>

// Synchronous with Option
const maybeUser = S.decodeOption(User)({ name: "Alice", age: 30 });
// Option<{ name: string; age: number }>

// Async/Promise
const userPromise = S.decodePromise(User)({ name: "Alice", age: 30 });

// Effect (for schemas with context R)
const userEffect = S.decode(User)({ name: "Alice", age: 30 });
// Effect<{ name: string; age: number }, ParseError, never>
```

### decodeUnknown vs decode

```typescript
// decodeUnknown - accepts unknown input, validates everything
S.decodeUnknownSync(User)(unknownData);

// decode - accepts the Encoded type (I), assumes structure is correct
S.decodeSync(User)(encodedUser); // TypeScript knows encodedUser shape
```

### Encoding

```typescript
// Same variants for encoding
S.encodeSync(User)(user);
S.encodeOption(User)(user);
S.encodeEither(User)(user);
S.encodePromise(User)(user);
S.encode(User)(user);

// encodeUnknown - for when input might be class instance
S.encodeUnknownSync(User)(possibleUser);
```

### Validation (no transformation)

```typescript
// Validate that a value matches the Type (A)
S.validateSync(User)(user);
S.validateOption(User)(user);
S.validateEither(User)(user);
S.validate(User)(user);

// Type guard
S.is(User)(value); // value is { name: string; age: number }

// Assertion
S.asserts(User)(value); // throws if invalid
```

### ParseError Structure

```typescript
import { ParseResult } from "effect";

type ParseIssue =
  | ParseResult.Type // wrong type
  | ParseResult.Missing // missing required field
  | ParseResult.Unexpected // extra field (when disallowed)
  | ParseResult.Forbidden // Effect not allowed (sync context)
  | ParseResult.Pointer // error at specific path
  | ParseResult.Refinement // refinement/filter failed
  | ParseResult.Transformation // transform failed
  | ParseResult.Composite; // multiple errors
```

### ParseOptions

```typescript
S.decodeSync(schema)(data, {
  // Report all errors vs first error only
  errors: "all" | "first", // default: "first"

  // Handle extra properties
  onExcessProperty: "ignore" | "error" | "preserve", // default: "ignore"
});

// Annotations can set default parse options
const StrictUser = User.annotations({
  parseOptions: { onExcessProperty: "error" },
});
```

### Formatting Errors

```typescript
import { ParseResult } from "effect";

// Tree format (default)
ParseResult.TreeFormatter.formatIssueSync(error.issue);
// └─ ["name"]
//    └─ Expected string, actual undefined

// Array format (flat list)
ParseResult.ArrayFormatter.formatIssueSync(error.issue);
// [{ path: ["name"], message: "Expected string, actual undefined" }]
```

---

## Common Patterns

### Class-based Schemas with Methods

```typescript
class Person extends S.Class<Person>("Person")({
  id: S.Number,
  firstName: S.String,
  lastName: S.String,
  age: S.Number,
}) {
  // Instance methods
  get fullName() {
    return `${this.firstName} ${this.lastName}`;
  }

  isAdult() {
    return this.age >= 18;
  }
}

// Usage
const person = new Person({
  id: 1,
  firstName: "John",
  lastName: "Doe",
  age: 25,
});
person.fullName; // "John Doe"
person.isAdult(); // true

// Decoding creates Person instances
const decoded = S.decodeSync(Person)({
  id: 1,
  firstName: "Jane",
  lastName: "Doe",
  age: 30,
});
decoded instanceof Person; // true

// Extending classes
class Employee extends Person.extend<Employee>("Employee")({
  department: S.String,
  salary: S.Number,
}) {
  get info() {
    return `${this.fullName} - ${this.department}`;
  }
}
```

### Tagged Classes (Discriminated Unions)

```typescript
class Circle extends S.TaggedClass<Circle>("Circle")("Circle", {
  radius: S.Number,
}) {
  get area() {
    return Math.PI * this.radius ** 2;
  }
}

class Rectangle extends S.TaggedClass<Rectangle>("Rectangle")("Rectangle", {
  width: S.Number,
  height: S.Number,
}) {
  get area() {
    return this.width * this.height;
  }
}

const Shape = S.Union(Circle, Rectangle);

// Pattern matching
function getArea(shape: S.Schema.Type<typeof Shape>) {
  switch (shape._tag) {
    case "Circle":
      return shape.area;
    case "Rectangle":
      return shape.area;
  }
}
```

### Tagged Errors

```typescript
class ValidationError extends S.TaggedError<ValidationError>()(
  "ValidationError",
  {
    field: S.String,
    message: S.String,
  }
) {
  get description() {
    return `${this.field}: ${this.message}`;
  }
}

// Usage with Effect
import { Effect } from "effect";

const validate = (data: unknown) =>
  Effect.gen(function* () {
    if (!data) {
      yield* new ValidationError({ field: "data", message: "Required" });
    }
    return data;
  });

// Error is catchable by tag
validate(null).pipe(
  Effect.catchTag("ValidationError", (e) => {
    console.log(e.description);
    return Effect.succeed(null);
  })
);
```

### Discriminated Unions with \_tag

```typescript
// Using TaggedStruct helper
const SuccessResult = S.TaggedStruct("Success", {
  data: S.Unknown,
});

const ErrorResult = S.TaggedStruct("Error", {
  message: S.String,
  code: S.Number,
});

const ApiResult = S.Union(SuccessResult, ErrorResult);

// Type-safe pattern matching
function handleResult(result: S.Schema.Type<typeof ApiResult>) {
  if (result._tag === "Success") {
    return result.data;
  } else {
    throw new Error(`${result.code}: ${result.message}`);
  }
}
```

### Recursive Schemas

```typescript
// Tree structure
interface TreeNode {
  readonly value: string;
  readonly children: readonly TreeNode[];
}

const TreeNode: S.Schema<TreeNode> = S.Struct({
  value: S.String,
  children: S.Array(S.suspend(() => TreeNode)),
});

// JSON-like structure
type Json =
  | null
  | boolean
  | number
  | string
  | readonly Json[]
  | { readonly [key: string]: Json };

const Json: S.Schema<Json> = S.Union(
  S.Null,
  S.Boolean,
  S.Number,
  S.String,
  S.Array(S.suspend(() => Json)),
  S.Record({ key: S.String, value: S.suspend(() => Json) })
);
```

### Field Renaming (snake_case <-> camelCase)

```typescript
const ApiResponse = S.Struct({
  userId: S.propertySignature(S.Number).pipe(S.fromKey("user_id")),
  createdAt: S.propertySignature(S.String).pipe(S.fromKey("created_at")),
  isActive: S.propertySignature(S.Boolean).pipe(S.fromKey("is_active")),
});

// Decode: { user_id: 1, created_at: "...", is_active: true }
// Type:   { userId: 1, createdAt: "...", isActive: true }
```

### Defaults (Constructor and Decoding)

```typescript
const Config = S.Struct({
  host: S.String,
  port: S.optionalWith(S.Number, { default: () => 3000 }),
  debug: S.optionalWith(S.Boolean, { default: () => false }),
  timeout: S.propertySignature(S.Number).pipe(
    S.withConstructorDefault(() => 5000)
  ),
});

// Decoding fills in missing optional fields
S.decodeSync(Config)({ host: "localhost" });
// { host: "localhost", port: 3000, debug: false, timeout: 5000 }

// Constructor also uses defaults
// When using Class patterns with .make()
```

### Effect-based Validation

```typescript
import { Effect, Context } from "effect";

// Define a service for async validation
class UserService extends Context.Tag("UserService")<
  UserService,
  { isEmailTaken: (email: string) => Effect.Effect<boolean> }
>() {}

// Schema with Effect-based filter
const UniqueEmail = S.String.pipe(
  S.filterEffect((email, _, ast) =>
    Effect.gen(function* () {
      const service = yield* UserService;
      const taken = yield* service.isEmailTaken(email);
      if (taken) {
        return { path: [], message: "Email already taken" };
      }
      return true;
    })
  )
);

// Schema now has context requirement
// Schema<string, string, UserService>
```

---

## Effect Integration

### Services in Schema Context

```typescript
import { Effect, Context, Layer } from "effect";

// Service tag
class ConfigService extends Context.Tag("ConfigService")<
  ConfigService,
  { getMaxLength: () => number }
>() {}

// Schema with service dependency
const DynamicString = S.String.pipe(
  S.filterEffect((s, _, ast) =>
    Effect.gen(function* () {
      const config = yield* ConfigService;
      const maxLength = config.getMaxLength();
      if (s.length > maxLength) {
        return `String too long (max: ${maxLength})`;
      }
      return true;
    })
  )
);
// Schema<string, string, ConfigService>

// Provide service when decoding
const program = S.decode(DynamicString)("hello world");

const ConfigLive = Layer.succeed(ConfigService, {
  getMaxLength: () => 100,
});

Effect.runPromise(program.pipe(Effect.provide(ConfigLive)));
```

### transformOrFail with Effect.gen

```typescript
const UserFromId = S.transformOrFail(
  S.Number, // from: user ID
  User, // to: full User object
  {
    strict: true,
    decode: (id, _, ast) =>
      Effect.gen(function* () {
        const db = yield* DatabaseService;
        const user = yield* db.findUser(id);
        if (!user) {
          return yield* ParseResult.fail(
            new ParseResult.Type(ast, id, `User ${id} not found`)
          );
        }
        return user;
      }),
    encode: (user) => ParseResult.succeed(user.id),
  }
);
// Schema<User, number, DatabaseService>
```

### Annotations for Effect-aware Errors

```typescript
const StrictEmail = S.String.pipe(
  S.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  S.annotations({
    // Custom message can be sync or Effect
    message: (issue) =>
      Effect.gen(function* () {
        const i18n = yield* I18nService;
        return yield* i18n.translate("invalid_email");
      }),

    // Custom title for parse issues
    parseIssueTitle: (issue) => `Invalid email format`,
  })
);
```

### Decoding Fallback

```typescript
const RobustNumber = S.Number.annotations({
  decodingFallback: (issue) => Effect.succeed(0), // Use 0 as fallback on parse failure
});

// With logging
const LoggedFallback = S.Number.annotations({
  decodingFallback: (issue) =>
    Effect.gen(function* () {
      const logger = yield* LoggerService;
      yield* logger.warn(`Parse failed, using default`);
      return 0;
    }),
});
```

---

## Quick Reference

### Common Decode/Encode Patterns

```typescript
// Parse JSON API response
const parseApiResponse = <A, I>(schema: S.Schema<A, I>) =>
  flow(S.parseJson(schema), S.decodeUnknownSync);

// Validate form data
const validateForm = <A, I>(schema: S.Schema<A, I>) =>
  S.decodeUnknownEither(schema);

// Serialize for storage
const serialize = <A, I>(schema: S.Schema<A, I>) =>
  flow(S.encodeSync(schema), JSON.stringify);
```

### Cheatsheet: Most-Used Combinators

| Need                   | Combinator                                         |
| ---------------------- | -------------------------------------------------- |
| Nullable field         | `S.NullOr(schema)`                                 |
| Optional field         | `S.optional(schema)`                               |
| With default           | `S.optionalWith(schema, { default: () => value })` |
| Union types            | `S.Union(schemaA, schemaB)`                        |
| Literal values         | `S.Literal("a", "b")`                              |
| Validate string length | `S.String.pipe(S.minLength(1), S.maxLength(100))`  |
| Validate number range  | `S.Number.pipe(S.between(0, 100))`                 |
| Array of items         | `S.Array(itemSchema)`                              |
| Non-empty array        | `S.NonEmptyArray(itemSchema)`                      |
| Object/Record          | `S.Struct({ field: schema })`                      |
| Dynamic keys           | `S.Record({ key: S.String, value: schema })`       |
| Pick fields            | `schema.pipe(S.pick("a", "b"))`                    |
| Omit fields            | `schema.pipe(S.omit("c"))`                         |
| Rename field           | `S.fromKey("original_name")`                       |
| Transform              | `S.transform(from, to, { decode, encode })`        |
| Brand type             | `schema.pipe(S.brand("BrandName"))`                |
| Add tag                | `S.attachPropertySignature("_tag", "Value")`       |
| Recursive              | `S.suspend(() => schema)`                          |
| Parse JSON             | `S.parseJson(schema)`                              |

### Type Extraction

```typescript
const MySchema = S.Struct({ name: S.String, age: S.Number });

// Extract types from schema
type MyType = S.Schema.Type<typeof MySchema>;
// { readonly name: string; readonly age: number }

type MyEncoded = S.Schema.Encoded<typeof MySchema>;
// { readonly name: string; readonly age: number }

type MyContext = S.Schema.Context<typeof MySchema>;
// never
```

### Schema Introspection

```typescript
// Check if value is a Schema
S.isSchema(maybeSchema);

// Get the encoded schema (strips transformations)
S.encodedSchema(schema);

// Get the type schema (Type side only)
S.typeSchema(schema);

// Format schema as string
S.format(schema); // "{ readonly name: string; readonly age: number }"
```

---

## Source Files

This reference is based on:

- `.repos/effect/packages/effect/src/Schema.ts` - Main API
- `.repos/effect/packages/effect/src/SchemaAST.ts` - AST types
- `.repos/effect/packages/effect/src/ParseResult.ts` - Parsing utilities
