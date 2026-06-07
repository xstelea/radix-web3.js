# @radix-effects/sbor

@radix-effects/sbor defines a developer-facing language for decoding and encoding Gateway programmatic SBOR values into typed JavaScript values while preserving Scrypto value meaning.

## Language

**Raw programmatic SBOR value**:
A Gateway-style JSON representation of a Scrypto value, including envelope metadata such as `kind`, `type_name`, `field_name`, `variant_id`, `element_kind`, and map key/value kinds.
_Avoid_: decoded value, manifest argument

**Decoded Scrypto value**:
The agent-readable JavaScript representation of a Scrypto value after schema decoding. It preserves Scrypto value meaning, but does not preserve every field from the raw programmatic SBOR envelope.
_Avoid_: raw SBOR, lossless SBOR

**Canonical encoded SBOR value**:
A programmatic SBOR value produced from a decoded Scrypto value and a schema. It may regenerate schema-derived metadata and normalize the raw shape while preserving Scrypto value meaning.
_Avoid_: lossless re-encoding, original SBOR

**Semantic round trip**:
The guarantee that decoding a canonical encoded SBOR value yields the same decoded Scrypto value. `encode(decode(raw))` is allowed to differ from `raw` when the difference is non-semantic envelope metadata.
_Avoid_: structural round trip, byte-for-byte round trip

**Explicit numeric schema**:
A schema for one concrete Scrypto numeric type, such as `U32`, `U128`, `I64`, `Decimal`, or `PreciseDecimal`. It decodes to `BigNumber`; the Scrypto numeric type is carried by the schema, not by the decoded value.
_Avoid_: loose number, generic numeric parser

**Generic numeric schema**:
A schema that accepts more than one Scrypto numeric type. It must preserve the concrete Scrypto numeric type alongside the decoded numeric value.
_Avoid_: number

**Scrypto numeric type**:
The on-ledger numeric kind encoded in SBOR, such as `U8`, `U32`, `U128`, `I64`, `Decimal`, or `PreciseDecimal`.
_Avoid_: JavaScript number type

**Decoded numeric value**:
The JavaScript representation of an SBOR numeric value. For this context, the canonical decoded numeric value is `BigNumber`.
_Avoid_: number, string

**Branded decoded value**:
A JavaScript value with a type-level brand that preserves domain meaning after decoding, using the shared branded schemas from `@radix-effects/shared`.
_Avoid_: plain string for semantic values

**Radix protocol brand**:
A shared brand whose identifier is namespaced under `@radix/types/...` to avoid collisions with application-level brands.
_Avoid_: unqualified Radix brand name

**Unconfigured schema**:
A schema with no runtime configuration, such as `string`, `bool`, `u32`, or `resourceAddress`. It is exported as a value, not as a no-argument constructor.
_Avoid_: primitive factory, no-arg schema function

**NonFungibleLocalId**:
The Radix SBOR local identifier for one non-fungible item. It is distinct from generic or application-level non-fungible identifiers and uses the shared `NonFungibleLocalId` brand.
_Avoid_: NonFungibleId

## Example Dialogue

Dev: "Can `u32` decode to `BigNumber` without losing the original Scrypto type?"

Domain expert: "Yes. `u32` is an explicit numeric schema, so the schema carries `U32`; the decoded numeric value can just be `BigNumber`."

Dev: "What about a schema that accepts both `U32` and `U128`?"

Domain expert: "That is a generic numeric schema. It must return both the decoded numeric value and the Scrypto numeric type."

Dev: "Should `encode(decode(raw))` produce the exact same programmatic SBOR object?"

Domain expert: "No. The SBOR language promises a semantic round trip: agents decode raw programmatic SBOR into decoded Scrypto values for reasoning, then encode canonical SBOR from a schema when needed. Keep the raw programmatic SBOR value separately when exact envelope preservation is required."
