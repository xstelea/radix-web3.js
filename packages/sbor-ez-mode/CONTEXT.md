# SBOR EZ Mode

SBOR EZ Mode defines a developer-facing language for decoding and encoding Gateway programmatic SBOR values into typed JavaScript values while preserving Scrypto value meaning.

## Language

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
