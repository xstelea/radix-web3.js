# Radix SBOR Reference

Technical reference for SBOR (Scrypto Binary Object Representation), the binary serialization format used throughout Radix. Source: `sbor/`, `sbor-derive/`, `sbor-derive-common/`, `radix-common/src/data/`.

## Overview

SBOR is a self-describing binary codec with:

- Typed binary encoding with value-kind prefixes on every value
- Extensible custom value kinds (Scrypto, Manifest)
- Schema system for validation and evolution tracking
- Depth-limited traversal for both typed and untyped payloads
- Derive macros for automatic implementation

## Wire Format

### Payload Structure

```
[Prefix Byte] [Root Value]
```

Each value:

```
[ValueKind u8] [Body...]
```

Body format depends on value kind.

### Payload Prefixes

| Context       | Prefix      | Constant                          |
| ------------- | ----------- | --------------------------------- |
| Basic SBOR    | `0x5b` (91) | `BASIC_SBOR_V1_PAYLOAD_PREFIX`    |
| Scrypto SBOR  | `0x5c` (92) | `SCRYPTO_SBOR_V1_PAYLOAD_PREFIX`  |
| Manifest SBOR | `0x5d` (93) | `MANIFEST_SBOR_V1_PAYLOAD_PREFIX` |

Max depth: 64 levels.

### Value Kind IDs

| ID      | Kind   | Body Format                                                    |
| ------- | ------ | -------------------------------------------------------------- |
| `0x01`  | Bool   | 1 byte (0x00/0x01)                                             |
| `0x02`  | I8     | 1 byte signed                                                  |
| `0x03`  | I16    | 2 bytes LE                                                     |
| `0x04`  | I32    | 4 bytes LE                                                     |
| `0x05`  | I64    | 8 bytes LE                                                     |
| `0x06`  | I128   | 16 bytes LE                                                    |
| `0x07`  | U8     | 1 byte                                                         |
| `0x08`  | U16    | 2 bytes LE                                                     |
| `0x09`  | U32    | 4 bytes LE                                                     |
| `0x0a`  | U64    | 8 bytes LE                                                     |
| `0x0b`  | U128   | 16 bytes LE                                                    |
| `0x0c`  | String | `[size LEB128][UTF-8 bytes]`                                   |
| `0x20`  | Array  | `[element_kind u8][size LEB128][elements...]`                  |
| `0x21`  | Tuple  | `[size LEB128][fields...]` (each field has own value kind)     |
| `0x22`  | Enum   | `[discriminator u8][size LEB128][fields...]`                   |
| `0x23`  | Map    | `[key_kind u8][value_kind u8][size LEB128][k1][v1][k2][v2]...` |
| `0x80+` | Custom | Application-defined                                            |

### Size Encoding (LEB128 variant)

Variable-length, 7 bits per byte, high bit = continuation:

- Max: `0x0FFFFFFF` (~268 MB)
- Example: 300 → `0xAC 0x02`

### Type Mappings

| Rust Type                        | SBOR Encoding                                  |
| -------------------------------- | ---------------------------------------------- |
| `struct { a, b }`                | Tuple with N fields                            |
| `enum { A, B(x) }`               | Enum, discriminator per variant                |
| `Vec<T>` / `&[T]`                | Array (element kind deduplicated)              |
| `Vec<u8>` / `&[u8]`              | Array(U8) — raw bytes, no per-element overhead |
| `BTreeMap<K,V>` / `HashMap<K,V>` | Map                                            |
| `Option<T>`                      | Enum: None=disc 0/size 0, Some=disc 1/size 1   |
| `Result<T,E>`                    | Enum: Ok=disc 0, Err=disc 1                    |
| `Box<T>` / `Rc<T>` / `Arc<T>`    | Transparent — encodes as inner type            |
| `(A, B, C)`                      | Tuple with N fields                            |
| `String`                         | String                                         |
| `[T; N]`                         | Array with exact size N                        |

### Encoding Example

Encoding `(42u32, "hi")`:

```
5b           payload prefix (basic SBOR)
21           VALUE_KIND_TUPLE
02           size = 2 fields
09           VALUE_KIND_U32
2a 00 00 00  42 in little-endian
0c           VALUE_KIND_STRING
02           size = 2 bytes
68 69        "hi" in UTF-8
```

## Core Traits

### Encode

```rust
pub trait Encode<X: CustomValueKind, E: Encoder<X>> {
    fn encode_value_kind(&self, encoder: &mut E) -> Result<(), EncodeError>;
    fn encode_body(&self, encoder: &mut E) -> Result<(), EncodeError>;
}
```

### Decode

```rust
pub trait Decode<X: CustomValueKind, D: Decoder<X>>: Sized {
    fn decode_body_with_value_kind(
        decoder: &mut D,
        value_kind: ValueKind<X>,
    ) -> Result<Self, DecodeError>;
}
```

### Categorize

Static value-kind classification. Required for types used as collection elements.

```rust
pub trait Categorize<X: CustomValueKind> {
    fn value_kind() -> ValueKind<X>;
}
```

### SborTuple / SborEnum

Runtime markers for structs and enums:

```rust
pub trait SborTuple<X: CustomValueKind> {
    fn get_length(&self) -> usize;
}

pub trait SborEnum<X: CustomValueKind> {
    fn get_discriminator(&self) -> u8;
    fn get_length(&self) -> usize;
}
```

### Describe

Schema generation:

```rust
pub trait Describe<C: CustomTypeKind<RustTypeId>> {
    const TYPE_ID: RustTypeId;
    fn type_data() -> TypeData<C, RustTypeId>;
    fn add_all_dependencies(aggregator: &mut TypeAggregator<C>) {}
}
```

## Custom Value Kinds

### CustomValueKind Trait

```rust
pub trait CustomValueKind: Copy + Debug + Clone + PartialEq + Eq {
    fn as_u8(&self) -> u8;               // Must be >= 0x80
    fn from_u8(id: u8) -> Option<Self>;
}
```

### ValueKind Enum

```rust
pub enum ValueKind<X: CustomValueKind> {
    Bool, I8, I16, I32, I64, I128,
    U8, U16, U32, U64, U128,
    String, Array, Tuple, Enum, Map,
    Custom(X),
}
```

### Scrypto Custom Value Kinds

| Kind                 | ID     | Rust Type                    | Wire Body                    |
| -------------------- | ------ | ---------------------------- | ---------------------------- |
| `Reference`          | `0x80` | `Reference` (wraps `NodeId`) | 30 bytes (NodeId)            |
| `Own`                | `0x90` | `Own` (wraps `NodeId`)       | 30 bytes (NodeId)            |
| `Decimal`            | `0xa0` | `Decimal`                    | 24 bytes (i192 LE)           |
| `PreciseDecimal`     | `0xb0` | `PreciseDecimal`             | 32 bytes (i256 LE)           |
| `NonFungibleLocalId` | `0xc0` | `NonFungibleLocalId`         | discriminator + variant data |

### Manifest Custom Value Kinds

| Kind                 | ID     | Description                |
| -------------------- | ------ | -------------------------- |
| `Address`            | `0x80` | Global/internal address    |
| `Bucket`             | `0x81` | Runtime bucket handle      |
| `Proof`              | `0x82` | Runtime proof handle       |
| `Expression`         | `0x83` | Manifest expression        |
| `Blob`               | `0x84` | Blob reference (hash)      |
| `Decimal`            | `0x85` | Financial decimal          |
| `PreciseDecimal`     | `0x86` | High-precision decimal     |
| `NonFungibleLocalId` | `0x87` | NFT local ID               |
| `AddressReservation` | `0x88` | Address reservation handle |

### CustomExtension Trait

Bundles value kind + traversal + schema:

```rust
pub trait CustomExtension: Debug + Clone + PartialEq + Eq {
    const PAYLOAD_PREFIX: u8;
    type CustomValueKind: CustomValueKind;
    type CustomTraversal: CustomTraversal<CustomValueKind = Self::CustomValueKind>;
    type CustomSchema: CustomSchema;

    fn custom_value_kind_matches_type_kind(
        schema: &Schema<Self::CustomSchema>,
        custom_value_kind: Self::CustomValueKind,
        type_kind: &LocalTypeKind<Self::CustomSchema>,
    ) -> bool;
}
```

Implementations: `ScryptoCustomExtension` (prefix 0x5c), `ManifestCustomExtension` (prefix 0x5d).

## Encoding & Decoding API

### Basic SBOR

```rust
let bytes = basic_encode(&value)?;          // -> Vec<u8>
let decoded: T = basic_decode(&bytes)?;     // -> T
```

### Scrypto SBOR

```rust
let bytes = scrypto_encode(&value)?;
let decoded: T = scrypto_decode(&bytes)?;

// With nice error messages (expensive, uses schema for diagnostics):
let decoded: T = scrypto_decode_with_nice_error(&bytes)?;

// Custom depth limit:
let bytes = scrypto_encode_with_depth_limit(&value, 32)?;
```

### Manifest SBOR

```rust
let bytes = manifest_encode(&value)?;
let decoded: T = manifest_decode(&bytes)?;
```

### Type Aliases

```rust
pub type ScryptoEncoder<'a> = VecEncoder<'a, ScryptoCustomValueKind>;
pub type ScryptoDecoder<'a> = VecDecoder<'a, ScryptoCustomValueKind>;
pub type ManifestEncoder<'a> = VecEncoder<'a, ManifestCustomValueKind>;
pub type ManifestDecoder<'a> = VecDecoder<'a, ManifestCustomValueKind>;
```

### Trait Aliases

```rust
pub trait ScryptoSbor: ScryptoCategorize + ScryptoDecode + ScryptoEncode + ScryptoDescribe {}
pub trait ManifestSbor: ManifestCategorize + ManifestDecode + ManifestEncode {}

// Component traits:
pub trait ScryptoCategorize: Categorize<ScryptoCustomValueKind> {}
pub trait ScryptoEncode: for<'a> Encode<ScryptoCustomValueKind, ScryptoEncoder<'a>> {}
pub trait ScryptoDecode: for<'a> Decode<ScryptoCustomValueKind, ScryptoDecoder<'a>> {}
pub trait ScryptoDescribe: Describe<ScryptoCustomTypeKind> {}
```

## Custom Encode/Decode

### Struct (Tuple Encoding)

```rust
impl<X: CustomValueKind, E: Encoder<X>> Encode<X, E> for MyType {
    fn encode_value_kind(&self, encoder: &mut E) -> Result<(), EncodeError> {
        encoder.write_value_kind(ValueKind::Tuple)
    }

    fn encode_body(&self, encoder: &mut E) -> Result<(), EncodeError> {
        encoder.write_size(2)?;        // field count
        encoder.encode(&self.x)?;      // encodes value_kind + body
        encoder.encode(&self.y)?;
        Ok(())
    }
}

impl<X: CustomValueKind, D: Decoder<X>> Decode<X, D> for MyType {
    fn decode_body_with_value_kind(
        decoder: &mut D,
        value_kind: ValueKind<X>,
    ) -> Result<Self, DecodeError> {
        decoder.check_preloaded_value_kind(value_kind, ValueKind::Tuple)?;
        decoder.read_and_check_size(2)?;
        Ok(MyType {
            x: decoder.decode()?,
            y: decoder.decode()?,
        })
    }
}
```

### Custom Value Kind Type

For types with custom wire format (e.g. Decimal, Reference):

```rust
impl Categorize<ScryptoCustomValueKind> for Decimal {
    fn value_kind() -> ValueKind<ScryptoCustomValueKind> {
        ValueKind::Custom(ScryptoCustomValueKind::Decimal)
    }
}

impl<E: Encoder<ScryptoCustomValueKind>> Encode<ScryptoCustomValueKind, E> for Decimal {
    fn encode_value_kind(&self, encoder: &mut E) -> Result<(), EncodeError> {
        encoder.write_value_kind(Self::value_kind())
    }

    fn encode_body(&self, encoder: &mut E) -> Result<(), EncodeError> {
        encoder.write_slice(&self.to_vec())  // fixed 24 bytes
    }
}

impl<D: Decoder<ScryptoCustomValueKind>> Decode<ScryptoCustomValueKind, D> for Decimal {
    fn decode_body_with_value_kind(
        decoder: &mut D,
        value_kind: ValueKind<ScryptoCustomValueKind>,
    ) -> Result<Self, DecodeError> {
        decoder.check_preloaded_value_kind(value_kind, Self::value_kind())?;
        let slice = decoder.read_slice(24)?;  // fixed size
        Self::try_from(slice).map_err(|_| DecodeError::InvalidCustomValue)
    }
}
```

### Enum with Custom Discriminators

```rust
impl<X: CustomValueKind, E: Encoder<X>> Encode<X, E> for NonFungibleLocalId {
    fn encode_value_kind(&self, encoder: &mut E) -> Result<(), EncodeError> {
        encoder.write_value_kind(ValueKind::Custom(ScryptoCustomValueKind::NonFungibleLocalId))
    }

    fn encode_body(&self, encoder: &mut E) -> Result<(), EncodeError> {
        match self {
            Self::String(v) => {
                encoder.write_discriminator(0)?;
                encoder.write_size(v.len())?;
                encoder.write_slice(v.as_bytes())?;
            }
            Self::Integer(v) => {
                encoder.write_discriminator(1)?;
                encoder.write_slice(&v.to_be_bytes())?;
            }
            Self::Bytes(v) => {
                encoder.write_discriminator(2)?;
                encoder.write_size(v.len())?;
                encoder.write_slice(v.as_ref())?;
            }
            Self::RUID(v) => {
                encoder.write_discriminator(3)?;
                encoder.write_slice(v.value().as_slice())?;
            }
        }
        Ok(())
    }
}
```

### Encoder/Decoder Methods

**Encoder:**

| Method                       | Description                                   |
| ---------------------------- | --------------------------------------------- |
| `write_value_kind(vk)`       | Write value kind byte                         |
| `write_discriminator(d: u8)` | Write enum discriminator                      |
| `write_size(n: usize)`       | Write LEB128 size                             |
| `write_byte(b: u8)`          | Write single byte                             |
| `write_slice(&[u8])`         | Write byte slice                              |
| `encode(&value)`             | Encode full value (kind + body), tracks depth |
| `encode_deeper_body(&value)` | Encode body only, tracks depth                |

**Decoder:**

| Method                                         | Description                     |
| ---------------------------------------------- | ------------------------------- |
| `read_value_kind()`                            | Read and parse value kind byte  |
| `read_discriminator()`                         | Read enum discriminator byte    |
| `read_size()`                                  | Read LEB128 size                |
| `read_byte()`                                  | Read single byte                |
| `read_slice(n)`                                | Read n bytes                    |
| `decode::<T>()`                                | Decode full value (kind + body) |
| `decode_deeper_body_with_value_kind(vk)`       | Decode body, tracks depth       |
| `check_preloaded_value_kind(actual, expected)` | Verify value kind matches       |
| `read_and_check_size(expected)`                | Read size and verify            |

## Schema System

### Type IDs

```rust
pub enum RustTypeId {
    WellKnown(WellKnownTypeId),  // Standard types with fixed IDs
    Novel(TypeHash),              // Hash-based ID from type structure
}

pub enum LocalTypeId {
    WellKnown(WellKnownTypeId),
    SchemaLocalIndex(usize),      // Index into schema vectors
}
```

### TypeKind

```rust
pub enum TypeKind<T: CustomTypeKind<L>, L: SchemaTypeLink> {
    Any,
    Bool, I8, I16, I32, I64, I128, U8, U16, U32, U64, U128,
    String,
    Array { element_type: L },
    Tuple { field_types: Vec<L> },
    Enum { variants: IndexMap<u8, Vec<L>> },
    Map { key_type: L, value_type: L },
    Custom(T),
}
```

### TypeData

```rust
pub struct TypeData<C: CustomTypeKind<RustTypeId>, L: SchemaTypeLink> {
    pub kind: TypeKind<C, L>,
    pub metadata: TypeMetadata,
    pub validation: TypeValidation<C::CustomTypeValidation>,
}
```

### TypeMetadata

```rust
pub struct TypeMetadata {
    pub type_name: Option<Cow<'static, str>>,
    pub child_names: Option<ChildNames>,
}

pub enum ChildNames {
    NamedFields(Vec<Cow<'static, str>>),
    EnumVariants(IndexMap<u8, TypeMetadata>),
}
```

### TypeValidation

```rust
pub enum TypeValidation<E: CustomTypeValidation> {
    None,
    I8(NumericValidation<i8>),
    // ... all numeric types ...
    U128(NumericValidation<u128>),
    String(LengthValidation),
    Array(LengthValidation),
    Map(LengthValidation),
    Custom(E),
}

pub struct NumericValidation<T> { pub min: Option<T>, pub max: Option<T> }
pub struct LengthValidation { pub min: Option<u32>, pub max: Option<u32> }
```

### Schema (full type database)

```rust
pub struct SchemaV1<S: CustomSchema> {
    pub type_kinds: Vec<LocalTypeKind<S>>,
    pub type_metadata: Vec<TypeMetadata>,
    pub type_validations: Vec<TypeValidation<S::CustomTypeValidation>>,
}
```

### Schema Generation

```rust
// Generate schema for a single type:
let (type_id, schema) = generate_full_schema_from_single_type::<MyType, BasicSchema>();

// Inspect:
let kind = schema.v1().resolve_type_kind(type_id);
let meta = schema.v1().resolve_type_metadata(type_id);
```

### Payload Validation Against Schema

```rust
validate_payload_against_schema::<ScryptoCustomExtension, _>(
    &encoded_bytes,
    &schema.as_unique_version(),
    type_id,
    &(),      // validation context
    64,       // depth limit
)?;
```

## Derive Macros

### Available Derives

| Derive            | Implements                                                          |
| ----------------- | ------------------------------------------------------------------- |
| `Sbor`            | Categorize + Encode + Decode + Describe (generic over custom kinds) |
| `Categorize`      | `Categorize<X>` + `SborTuple`/`SborEnum`                            |
| `Encode`          | `Encode<X, E>`                                                      |
| `Decode`          | `Decode<X, D>`                                                      |
| `Describe`        | `Describe<C>`                                                       |
| `BasicSbor`       | All above for `NoCustomValueKind` only                              |
| `BasicCategorize` | Categorize for basic SBOR                                           |
| `BasicEncode`     | Encode for basic SBOR                                               |
| `BasicDecode`     | Decode for basic SBOR                                               |
| `BasicDescribe`   | Describe for basic SBOR                                             |
| `ScryptoSbor`     | All for `ScryptoCustomValueKind` (from `radix-sbor-derive`)         |
| `ManifestSbor`    | All for `ManifestCustomValueKind` (from `radix-sbor-derive`)        |

### Type-Level Attributes

| Attribute                             | Description                                               |
| ------------------------------------- | --------------------------------------------------------- |
| `#[sbor(custom_value_kind = "Path")]` | Specify custom value kind instead of generic X            |
| `#[sbor(custom_type_kind = "Path")]`  | Specify custom type kind for Describe                     |
| `#[sbor(transparent)]`                | Delegate to single inner field (newtype pattern)          |
| `#[sbor(as_type = "Type")]`           | Encode/decode by converting to/from another type          |
| `#[sbor(as_ref = "expr")]`            | Conversion expression for as_type encoding (uses `self`)  |
| `#[sbor(from_value = "expr")]`        | Conversion expression for as_type decoding (uses `value`) |
| `#[sbor(type_name = "Name")]`         | Override type name in schema                              |
| `#[sbor(transparent_name)]`           | Keep automatic name even for transparent types            |
| `#[sbor(child_types = "T1; T2")]`     | Explicit child types for trait bounds                     |
| `#[sbor(categorize_types = "T1")]`    | Types requiring Categorize bound                          |
| `#[sbor(use_repr_discriminators)]`    | Use `enum Foo { A = 5 }` discriminant values              |
| `#[sbor(impl_variant_traits)]`        | Generate variant-specific trait impls                     |

### Field/Variant-Level Attributes

| Attribute                     | Description                                                    |
| ----------------------------- | -------------------------------------------------------------- |
| `#[sbor(skip)]`               | Exclude from encoding; uses `Default::default()` on decode     |
| `#[sbor(flatten)]`            | Flatten single-field variant (field must be SborTuple)         |
| `#[sbor(discriminator(val))]` | Custom variant discriminator (u8 literal, const path, or expr) |
| `#[sbor(unreachable)]`        | Variant panics if matched                                      |
| `#[sbor(impl_variant_trait)]` | Generate variant trait for this specific variant               |

### Schema Assertion

```rust
#[derive(BasicSbor, BasicSborAssertion)]
#[sbor_assert(fixed("FILE:schemas/MyType.bin"))]
pub struct MyType { ... }

#[derive(BasicSbor, BasicSborAssertion)]
#[sbor_assert(backwards_compatible(
    v1 = "FILE:schemas/MyType-v1.bin",
    v2 = "FILE:schemas/MyType-v2.bin",
))]
pub struct MyType { ... }
```

Location formats: `"FILE:path"`, `"INLINE:hexstring"`, `"CONST:NAME"`, `"EXPR:fn()"`.

### Derive Examples

**Basic struct:**

```rust
#[derive(ScryptoSbor)]
pub struct Transfer {
    pub from: ComponentAddress,
    pub to: ComponentAddress,
    pub amount: Decimal,
}
```

**Enum with explicit discriminators:**

```rust
#[derive(ScryptoSbor)]
pub enum Status {
    #[sbor(discriminator(0))]
    Active,
    #[sbor(discriminator(1))]
    Inactive { reason: String },
}
```

**Transparent newtype:**

```rust
#[derive(ScryptoSbor)]
#[sbor(transparent)]
pub struct Wrapper(Vec<u8>);
```

**Derive-as pattern:**

```rust
#[derive(ScryptoSbor)]
#[sbor(
    as_type = "String",
    as_ref = "&self.0",
    from_value = "Self(value)"
)]
pub struct Name(String);
```

**With repr discriminators:**

```rust
#[derive(ScryptoSbor)]
#[sbor(use_repr_discriminators)]
#[repr(u8)]
pub enum MyEnum {
    A = 5,
    B = 10,
    C = 20,
}
```

## Traversal System

### Untyped Traversal

Walk payloads without schema knowledge:

```rust
let mut traverser = VecTraverser::new(
    &bytes,
    ExpectedStart::PayloadPrefix(SCRYPTO_SBOR_V1_PAYLOAD_PREFIX),
    VecTraverserConfig { max_depth: 64, check_exact_end: true },
);

loop {
    let event = traverser.next_event();
    match event.event {
        TraversalEvent::ContainerStart(header) => { /* header.child_count() */ }
        TraversalEvent::TerminalValue(value) => { /* inspect value */ }
        TraversalEvent::ContainerEnd => {}
        TraversalEvent::DecodeError(err) => break,
        TraversalEvent::End => break,
    }
}
```

### Typed Traversal

Walk payloads with schema validation:

```rust
let mut traverser = traverse_payload_with_types::<ScryptoCustomExtension>(
    &bytes,
    &schema.as_unique_version(),
    root_type_id,
    64, // depth limit
);

loop {
    let event = traverser.next_event();
    match event.event {
        TypedTraversalEvent::ContainerStart(header) => {
            let type_id = event.location.container_type.self_type();
        }
        TypedTraversalEvent::TerminalValue(value) => {
            let path = event.location.path_to_string(&schema);
        }
        TypedTraversalEvent::ValueMismatchWithType(err) => { /* schema mismatch */ }
        TypedTraversalEvent::End => break,
        _ => {}
    }
}
```

## Macro for Custom Value Kind Types

The `well_known_scrypto_custom_type!` macro generates all four traits (Categorize, Encode, Decode, Describe) for fixed-size custom value types:

```rust
well_known_scrypto_custom_type!(
    Reference,                           // Rust type
    ScryptoCustomValueKind::Reference,   // Value kind variant
    Type::Reference,                     // Schema type
    NodeId::LENGTH,                      // Fixed body size in bytes
    REFERENCE_TYPE,                      // Well-known type constant
    reference_type_data                  // Type data function name
);
```

This generates:

- `Categorize` → returns `ValueKind::Custom(kind)`
- `Encode` → writes value kind + `self.to_vec()` body
- `Decode` → reads fixed slice + `try_from`
- `Describe` → returns well-known type ID and data

## Error Types

### EncodeError

| Variant                                | Description                  |
| -------------------------------------- | ---------------------------- |
| `MaxDepthExceeded(usize)`              | Nesting exceeded limit       |
| `SizeTooLarge { actual, max_allowed }` | Payload too large (>268 MB)  |
| `MismatchingArrayElementValueKind`     | Array element has wrong kind |
| `MismatchingMapKeyValueKind`           | Map key has wrong kind       |
| `MismatchingMapValueValueKind`         | Map value has wrong kind     |

### DecodeError

| Variant                                        | Description                  |
| ---------------------------------------------- | ---------------------------- |
| `BufferUnderflow { required, remaining }`      | Not enough bytes             |
| `UnexpectedPayloadPrefix { expected, actual }` | Wrong prefix byte            |
| `UnexpectedValueKind { expected, actual }`     | Type mismatch                |
| `UnexpectedCustomValueKind { actual }`         | Unknown custom kind          |
| `UnexpectedSize { expected, actual }`          | Field count mismatch         |
| `UnexpectedDiscriminator { expected, actual }` | Wrong enum variant           |
| `UnknownDiscriminator(u8)`                     | Enum variant doesn't exist   |
| `InvalidBool(u8)`                              | Bool byte not 0x00/0x01      |
| `InvalidUtf8`                                  | String not valid UTF-8       |
| `InvalidSize`                                  | LEB128 overflow              |
| `MaxDepthExceeded(usize)`                      | Nesting exceeded limit       |
| `DuplicateKey`                                 | Map has duplicate keys       |
| `InvalidCustomValue`                           | Custom value parse failure   |
| `ExtraTrailingBytes(usize)`                    | Bytes remaining after decode |

## RawPayload & RawValue

Efficient wrappers for encoded SBOR payloads without full deserialization:

```rust
// Wrap already-validated bytes
let raw = RawPayload::<ScryptoCustomExtension>::new_from_valid_slice(&bytes);

// Check root value kind
let kind = raw.root_value_kind();

// Full decode when needed
let value: MyType = raw.decode_into(64)?;
```

## Key Design Patterns

### Dual Scrypto/Manifest Support

Most types implement SBOR for both Scrypto and Manifest custom value kinds. Common pattern uses a shared encode/decode body:

```rust
// Shared logic
fn encode_body_common<X: CustomValueKind, E: Encoder<X>>(&self, encoder: &mut E) -> Result<(), EncodeError> {
    // ...generic body encoding...
}

// Scrypto impl
impl<E: Encoder<ScryptoCustomValueKind>> Encode<ScryptoCustomValueKind, E> for MyType {
    fn encode_body(&self, encoder: &mut E) -> Result<(), EncodeError> {
        self.encode_body_common(encoder)
    }
}

// Manifest impl
impl<E: Encoder<ManifestCustomValueKind>> Encode<ManifestCustomValueKind, E> for MyType {
    fn encode_body(&self, encoder: &mut E) -> Result<(), EncodeError> {
        self.encode_body_common(encoder)
    }
}
```

### Manifest Validates Against Scrypto Schema

`ManifestCustomExtension` uses `ScryptoCustomSchema` for validation. Manifest value kinds map to Scrypto type kinds:

| Manifest Kind        | Maps To Scrypto TypeKind           |
| -------------------- | ---------------------------------- |
| `Address`            | `ScryptoCustomTypeKind::Reference` |
| `Bucket`             | `ScryptoCustomTypeKind::Own`       |
| `Proof`              | `ScryptoCustomTypeKind::Own`       |
| `AddressReservation` | `ScryptoCustomTypeKind::Own`       |
| `Decimal`            | `ScryptoCustomTypeKind::Decimal`   |

### Depth Tracking

All encode/decode operations track nesting depth to prevent stack overflow:

```rust
// encoder.encode(&child) internally calls:
//   1. depth += 1
//   2. child.encode_value_kind(encoder)
//   3. child.encode_body(encoder)
//   4. depth -= 1
// Returns MaxDepthExceeded if depth > limit
```

Smart pointers (`Box`, `Rc`, `Arc`) are transparent — they don't increase depth.
