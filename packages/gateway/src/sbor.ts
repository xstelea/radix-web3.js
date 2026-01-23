import { Schema } from 'effect';

export const ScryptoSborValueKind = Schema.Literal(
  'Bool',
  'I8',
  'I16',
  'I32',
  'I64',
  'I128',
  'U8',
  'U16',
  'U32',
  'U64',
  'U128',
  'String',
  'Enum',
  'Array',
  'Bytes',
  'Map',
  'Tuple',
  'Reference',
  'Own',
  'Decimal',
  'PreciseDecimal',
  'NonFungibleLocalId',
);

export type ScryptoSborValueKind = typeof ScryptoSborValueKind.Type;

const ScryptoSborValueBase = Schema.Struct({
  type_name: Schema.optional(Schema.NullOr(Schema.String)),
  field_name: Schema.optional(Schema.NullOr(Schema.String)),
});

const ScryptoSborValueBool = Schema.Struct({
  ...ScryptoSborValueBase.fields,
  kind: Schema.Literal('Bool'),
  value: Schema.Boolean,
});

const ScryptoSborValueString = Schema.Struct({
  ...ScryptoSborValueBase.fields,
  kind: Schema.Literal('String'),
  value: Schema.String,
});

const ScryptoSborValueBytes = Schema.Struct({
  ...ScryptoSborValueBase.fields,
  kind: Schema.Literal('Bytes'),
  element_kind: ScryptoSborValueKind,
  element_type_name: Schema.optional(Schema.String),
  hex: Schema.String,
});

const ScryptoSborValueDecimal = Schema.Struct({
  ...ScryptoSborValueBase.fields,
  kind: Schema.Literal('Decimal'),
  value: Schema.String,
});

const ScryptoSborValuePreciseDecimal = Schema.Struct({
  ...ScryptoSborValueBase.fields,
  kind: Schema.Literal('PreciseDecimal'),
  value: Schema.String,
});

const ScryptoSborValueReference = Schema.Struct({
  ...ScryptoSborValueBase.fields,
  kind: Schema.Literal('Reference'),
  value: Schema.String,
});

const ScryptoSborValueOwn = Schema.Struct({
  ...ScryptoSborValueBase.fields,
  kind: Schema.Literal('Own'),
  value: Schema.String,
});

const ScryptoSborValueNonFungibleLocalId = Schema.Struct({
  ...ScryptoSborValueBase.fields,
  kind: Schema.Literal('NonFungibleLocalId'),
  value: Schema.String,
});

const ScryptoSborValueI8 = Schema.Struct({
  ...ScryptoSborValueBase.fields,
  kind: Schema.Literal('I8'),
  value: Schema.String,
});

const ScryptoSborValueI16 = Schema.Struct({
  ...ScryptoSborValueBase.fields,
  kind: Schema.Literal('I16'),
  value: Schema.String,
});

const ScryptoSborValueI32 = Schema.Struct({
  ...ScryptoSborValueBase.fields,
  kind: Schema.Literal('I32'),
  value: Schema.String,
});

const ScryptoSborValueI64 = Schema.Struct({
  ...ScryptoSborValueBase.fields,
  kind: Schema.Literal('I64'),
  value: Schema.String,
});

const ScryptoSborValueI128 = Schema.Struct({
  ...ScryptoSborValueBase.fields,
  kind: Schema.Literal('I128'),
  value: Schema.String,
});

const ScryptoSborValueU8 = Schema.Struct({
  ...ScryptoSborValueBase.fields,
  kind: Schema.Literal('U8'),
  value: Schema.String,
});

const ScryptoSborValueU16 = Schema.Struct({
  ...ScryptoSborValueBase.fields,
  kind: Schema.Literal('U16'),
  value: Schema.String,
});

const ScryptoSborValueU32 = Schema.Struct({
  ...ScryptoSborValueBase.fields,
  kind: Schema.Literal('U32'),
  value: Schema.String,
});

const ScryptoSborValueU64 = Schema.Struct({
  ...ScryptoSborValueBase.fields,
  kind: Schema.Literal('U64'),
  value: Schema.String,
});

const ScryptoSborValueU128 = Schema.Struct({
  ...ScryptoSborValueBase.fields,
  kind: Schema.Literal('U128'),
  value: Schema.String,
});

type ScryptoSborValueBool = typeof ScryptoSborValueBool.Type;
type ScryptoSborValueString = typeof ScryptoSborValueString.Type;
type ScryptoSborValueBytes = typeof ScryptoSborValueBytes.Type;
type ScryptoSborValueDecimal = typeof ScryptoSborValueDecimal.Type;
type ScryptoSborValuePreciseDecimal =
  typeof ScryptoSborValuePreciseDecimal.Type;
type ScryptoSborValueReference = typeof ScryptoSborValueReference.Type;
type ScryptoSborValueOwn = typeof ScryptoSborValueOwn.Type;
type ScryptoSborValueNonFungibleLocalId =
  typeof ScryptoSborValueNonFungibleLocalId.Type;
type ScryptoSborValueI8 = typeof ScryptoSborValueI8.Type;
type ScryptoSborValueI16 = typeof ScryptoSborValueI16.Type;
type ScryptoSborValueI32 = typeof ScryptoSborValueI32.Type;
type ScryptoSborValueI64 = typeof ScryptoSborValueI64.Type;
type ScryptoSborValueI128 = typeof ScryptoSborValueI128.Type;
type ScryptoSborValueU8 = typeof ScryptoSborValueU8.Type;
type ScryptoSborValueU16 = typeof ScryptoSborValueU16.Type;
type ScryptoSborValueU32 = typeof ScryptoSborValueU32.Type;
type ScryptoSborValueU64 = typeof ScryptoSborValueU64.Type;
type ScryptoSborValueU128 = typeof ScryptoSborValueU128.Type;

interface ScryptoSborValueArray {
  type_name?: string | null | undefined;
  field_name?: string | null | undefined;
  kind: 'Array';
  element_kind: ScryptoSborValueKind;
  element_type_name?: string | undefined;
  elements: readonly ScryptoSborValueSchema[];
}

interface ScryptoSborValueMapEntry {
  key: ScryptoSborValueSchema;
  value: ScryptoSborValueSchema;
}

interface ScryptoSborValueMap {
  type_name?: string | null | undefined;
  field_name?: string | null | undefined;
  kind: 'Map';
  key_kind: ScryptoSborValueKind;
  key_type_name?: string | undefined;
  value_kind: ScryptoSborValueKind;
  value_type_name?: string | undefined;
  entries: readonly ScryptoSborValueMapEntry[];
}

interface ScryptoSborValueTuple {
  type_name?: string | null | undefined;
  field_name?: string | null | undefined;
  kind: 'Tuple';
  fields: readonly ScryptoSborValueSchema[];
}

interface ScryptoSborValueEnum {
  type_name?: string | null | undefined;
  field_name?: string | null | undefined;
  kind: 'Enum';
  variant_id: string;
  variant_name?: string | undefined;
  fields: readonly ScryptoSborValueSchema[];
}

export type ScryptoSborValueSchema =
  | ScryptoSborValueBool
  | ScryptoSborValueString
  | ScryptoSborValueBytes
  | ScryptoSborValueDecimal
  | ScryptoSborValuePreciseDecimal
  | ScryptoSborValueReference
  | ScryptoSborValueOwn
  | ScryptoSborValueNonFungibleLocalId
  | ScryptoSborValueI8
  | ScryptoSborValueI16
  | ScryptoSborValueI32
  | ScryptoSborValueI64
  | ScryptoSborValueI128
  | ScryptoSborValueU8
  | ScryptoSborValueU16
  | ScryptoSborValueU32
  | ScryptoSborValueU64
  | ScryptoSborValueU128
  | ScryptoSborValueArray
  | ScryptoSborValueMap
  | ScryptoSborValueTuple
  | ScryptoSborValueEnum;

export type { ScryptoSborValueMapEntry };

const ScryptoSborValueMapEntrySchema: Schema.Schema<ScryptoSborValueMapEntry> =
  Schema.suspend(() =>
    Schema.Struct({
      key: ScryptoSborValueSchema,
      value: ScryptoSborValueSchema,
    }),
  );

const ScryptoSborValueArraySchema: Schema.Schema<ScryptoSborValueArray> =
  Schema.suspend(() =>
    Schema.Struct({
      ...ScryptoSborValueBase.fields,
      kind: Schema.Literal('Array'),
      element_kind: ScryptoSborValueKind,
      element_type_name: Schema.optional(Schema.String),
      elements: Schema.Array(ScryptoSborValueSchema),
    }),
  );

const ScryptoSborValueMapSchema: Schema.Schema<ScryptoSborValueMap> =
  Schema.suspend(() =>
    Schema.Struct({
      ...ScryptoSborValueBase.fields,
      kind: Schema.Literal('Map'),
      key_kind: ScryptoSborValueKind,
      key_type_name: Schema.optional(Schema.String),
      value_kind: ScryptoSborValueKind,
      value_type_name: Schema.optional(Schema.String),
      entries: Schema.Array(ScryptoSborValueMapEntrySchema),
    }),
  );

const ScryptoSborValueTupleSchema: Schema.Schema<ScryptoSborValueTuple> =
  Schema.suspend(() =>
    Schema.Struct({
      ...ScryptoSborValueBase.fields,
      kind: Schema.Literal('Tuple'),
      fields: Schema.Array(ScryptoSborValueSchema),
    }),
  );

const ScryptoSborValueEnumSchema: Schema.Schema<ScryptoSborValueEnum> =
  Schema.suspend(() =>
    Schema.Struct({
      ...ScryptoSborValueBase.fields,
      kind: Schema.Literal('Enum'),
      variant_id: Schema.String,
      variant_name: Schema.optional(Schema.String),
      fields: Schema.Array(ScryptoSborValueSchema),
    }),
  );

export const ScryptoSborValueSchema: Schema.Schema<ScryptoSborValueSchema> =
  Schema.Union(
    ScryptoSborValueBool,
    ScryptoSborValueString,
    ScryptoSborValueBytes,
    ScryptoSborValueDecimal,
    ScryptoSborValuePreciseDecimal,
    ScryptoSborValueReference,
    ScryptoSborValueOwn,
    ScryptoSborValueNonFungibleLocalId,
    ScryptoSborValueI8,
    ScryptoSborValueI16,
    ScryptoSborValueI32,
    ScryptoSborValueI64,
    ScryptoSborValueI128,
    ScryptoSborValueU8,
    ScryptoSborValueU16,
    ScryptoSborValueU32,
    ScryptoSborValueU64,
    ScryptoSborValueU128,
    ScryptoSborValueArraySchema,
    ScryptoSborValueMapSchema,
    ScryptoSborValueTupleSchema,
    ScryptoSborValueEnumSchema,
  );
