import { BigNumber } from 'bignumber.js';
import { Data, Effect, flow, Option, ParseResult, pipe, Schema } from 'effect';
import type {
  ProgrammaticScryptoSborValueI8,
  ProgrammaticScryptoSborValueI16,
  ProgrammaticScryptoSborValueI32,
  ProgrammaticScryptoSborValueI64,
  ProgrammaticScryptoSborValueI128,
  ProgrammaticScryptoSborValueU8,
  ProgrammaticScryptoSborValueU16,
  ProgrammaticScryptoSborValueU32,
  ProgrammaticScryptoSborValueU64,
  ProgrammaticScryptoSborValueU128,
} from '@radixdlt/babylon-gateway-api-sdk';
import {
  AccountAddress,
  ComponentAddress,
  InternalAddress,
  KeyValueStoreAddress,
  NonFungibleLocalId,
  NonFungibleResourceAddress,
  PackageAddress,
  ResourceAddress,
  VaultAddress,
} from '@radix-effects/shared';

export type SborKind =
  | 'Bool'
  | 'I8'
  | 'I16'
  | 'I32'
  | 'I64'
  | 'I128'
  | 'U8'
  | 'U16'
  | 'U32'
  | 'U64'
  | 'U128'
  | 'String'
  | 'Enum'
  | 'Array'
  | 'Bytes'
  | 'Map'
  | 'Tuple'
  | 'Reference'
  | 'Own'
  | 'Decimal'
  | 'PreciseDecimal'
  | 'NonFungibleLocalId';

export type ProgrammaticScryptoSborValueNumber =
  | ProgrammaticScryptoSborValueI8
  | ProgrammaticScryptoSborValueI16
  | ProgrammaticScryptoSborValueI32
  | ProgrammaticScryptoSborValueI64
  | ProgrammaticScryptoSborValueI128
  | ProgrammaticScryptoSborValueU8
  | ProgrammaticScryptoSborValueU16
  | ProgrammaticScryptoSborValueU32
  | ProgrammaticScryptoSborValueU64
  | ProgrammaticScryptoSborValueU128;

export type IntegerKind = ProgrammaticScryptoSborValueNumber['kind'];

export type DecimalKind = 'Decimal' | 'PreciseDecimal';
export type NumericKind = IntegerKind | DecimalKind;

export type GenericNumeric = {
  readonly type: NumericKind;
  readonly value: BigNumber;
};

type Ast = Parameters<
  NonNullable<Parameters<typeof Schema.transformOrFail>[2]['decode']>
>[2];

type SborInfo = {
  readonly kind: SborKind;
  readonly typeName: Option.Option<string>;
};

export type NativeSborSchema = Schema.Schema.Any & {
  readonly sbor: SborInfo;
};

export type Infer<S extends Schema.Schema.All> = Schema.Schema.Type<S>;

interface SborDecodeIssue {
  readonly _tag: 'SborDecodeIssue';
  readonly message: string;
  readonly path: readonly string[];
}

const SborDecodeIssue = Data.tagged<SborDecodeIssue>('SborDecodeIssue');

const renderIssue = flow((issue: SborDecodeIssue) =>
  issue.path.length === 0
    ? issue.message
    : `${issue.message} at ${issue.path.join('.')}`,
);

const parseIssue =
  (ast: Ast, input: unknown) =>
  (issue: SborDecodeIssue): ParseResult.Type =>
    new ParseResult.Type(ast, input, renderIssue(issue));

const fail = (
  ast: Ast,
  input: unknown,
  message: string,
  path: readonly string[] = [],
): Effect.Effect<never, ParseResult.Type> =>
  Effect.fail(
    pipe({ message, path }, SborDecodeIssue, parseIssue(ast, input)),
  );

const withSbor = <S extends Schema.Schema.All>(
  schema: S,
  kind: SborKind,
  typeName: Option.Option<string> = Option.none(),
) => Object.assign(schema, { sbor: Data.struct({ kind, typeName }) });

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === 'object' && input !== null;

const optionalString = Schema.optional(Schema.NullOr(Schema.String));

const baseFields = {
  type_name: optionalString,
  field_name: optionalString,
};

const SborBool = Schema.Struct({
  ...baseFields,
  kind: Schema.Literal('Bool'),
  value: Schema.Boolean,
});

const SborString = Schema.Struct({
  ...baseFields,
  kind: Schema.Literal('String'),
  value: Schema.String,
});

const SborBytes = Schema.Struct({
  ...baseFields,
  kind: Schema.Literal('Bytes'),
  element_kind: Schema.String,
  element_type_name: optionalString,
  hex: Schema.String,
});

const SborTuple = Schema.Struct({
  ...baseFields,
  kind: Schema.Literal('Tuple'),
  fields: Schema.Array(Schema.Unknown),
});

const SborArray = Schema.Struct({
  ...baseFields,
  kind: Schema.Literal('Array'),
  element_kind: Schema.String,
  element_type_name: optionalString,
  elements: Schema.Array(Schema.Unknown),
});

const SborMap = Schema.Struct({
  ...baseFields,
  kind: Schema.Literal('Map'),
  key_kind: Schema.String,
  key_type_name: optionalString,
  value_kind: Schema.String,
  value_type_name: optionalString,
  entries: Schema.Array(
    Schema.Struct({
      key: Schema.Unknown,
      value: Schema.Unknown,
    }),
  ),
});

const SborEnum = Schema.Struct({
  ...baseFields,
  kind: Schema.Literal('Enum'),
  type_name: optionalString,
  variant_id: Schema.String,
  variant_name: optionalString,
  fields: Schema.Array(Schema.Unknown),
});

const SborReference = Schema.Struct({
  ...baseFields,
  kind: Schema.Literal('Reference'),
  type_name: Schema.String,
  value: Schema.String,
});

const SborOwn = Schema.Struct({
  ...baseFields,
  kind: Schema.Literal('Own'),
  type_name: Schema.String,
  value: Schema.String,
});

const sborInteger = (kind: IntegerKind) =>
  Schema.Struct({
    ...baseFields,
    kind: Schema.Literal(kind),
    value: Schema.String,
  });

const sborDecimal = (kind: DecimalKind) =>
  Schema.Struct({
    ...baseFields,
    kind: Schema.Literal(kind),
    value: Schema.String,
  });

const SborIntegerI64Instant = Schema.Struct({
  ...baseFields,
  kind: Schema.Literal('I64'),
  type_name: Schema.Literal('Instant'),
  value: Schema.String,
});

const NumericKindSchema = Schema.Literal(
  'U8',
  'U16',
  'U32',
  'U64',
  'U128',
  'I8',
  'I16',
  'I32',
  'I64',
  'I128',
  'Decimal',
  'PreciseDecimal',
);

const GenericNumericSchema = Schema.Struct({
  type: NumericKindSchema,
  value: Schema.instanceOf(BigNumber),
});

const integerRange = (kind: IntegerKind) => {
  switch (kind) {
    case 'U8':
      return Data.struct({ min: 0n, max: 255n });
    case 'U16':
      return Data.struct({ min: 0n, max: 65535n });
    case 'U32':
      return Data.struct({ min: 0n, max: 4294967295n });
    case 'U64':
      return Data.struct({ min: 0n, max: 18446744073709551615n });
    case 'U128':
      return Data.struct({
        min: 0n,
        max: 340282366920938463463374607431768211455n,
      });
    case 'I8':
      return Data.struct({ min: -128n, max: 127n });
    case 'I16':
      return Data.struct({ min: -32768n, max: 32767n });
    case 'I32':
      return Data.struct({ min: -2147483648n, max: 2147483647n });
    case 'I64':
      return Data.struct({
        min: -9223372036854775808n,
        max: 9223372036854775807n,
      });
    case 'I128':
      return Data.struct({
        min: -170141183460469231731687303715884105728n,
        max: 170141183460469231731687303715884105727n,
      });
  }
};

const parseBigInt = (value: string, ast: Ast, input: unknown) =>
  Effect.try({
    try: () => BigInt(value),
    catch: () =>
      new ParseResult.Type(ast, input, 'Integer value must be a valid string'),
  });

const parseBigNumber = (value: string, ast: Ast, input: unknown) =>
  Effect.try({
    try: () => new BigNumber(value),
    catch: () =>
      new ParseResult.Type(ast, input, 'Numeric value must be a valid string'),
  }).pipe(
    Effect.flatMap((numeric) =>
      numeric.isFinite()
        ? Effect.succeed(numeric)
        : fail(ast, input, 'Numeric value must be finite'),
    ),
  );

const validateInteger = (
  kind: IntegerKind,
  value: string,
  ast: Ast,
  input: unknown,
) =>
  pipe(
    parseBigInt(value, ast, input),
    Effect.flatMap((integer) => {
      const range = integerRange(kind);
      return integer < range.min || integer > range.max
        ? fail(
            ast,
            input,
            `Number out of range for ${kind}. Must be between ${range.min} and ${range.max}`,
          )
        : Effect.void;
    }),
  );

const integerValue = (kind: IntegerKind, value: string, ast: Ast) =>
  pipe(
    parseBigNumber(value, ast, value),
    Effect.tap(() => validateInteger(kind, value, ast, value)),
  );

const encodedInteger = (kind: IntegerKind, value: BigNumber, ast: Ast) =>
  Effect.gen(function* () {
    if (!value.isInteger()) {
      return yield* fail(ast, value, `${kind} value must be an integer`);
    }
    const encoded = value.toFixed(0);
    yield* validateInteger(kind, encoded, ast, value);
    return Data.struct({ kind, value: encoded });
  });

const numericKind = (input: unknown): Option.Option<NumericKind> =>
  isRecord(input) && typeof input.kind === 'string'
    ? pipe(
        Schema.decodeUnknownEither(NumericKindSchema)(input.kind),
        Option.liftPredicate((either) => either._tag === 'Right'),
        Option.map((either) => either.right),
      )
    : Option.none();

const isIntegerKind = (kind: NumericKind): kind is IntegerKind =>
  kind !== 'Decimal' && kind !== 'PreciseDecimal';

const numericValue = (kind: NumericKind, value: string, ast: Ast) =>
  isIntegerKind(kind)
    ? integerValue(kind, value, ast)
    : parseBigNumber(value, ast, value);

const fieldByName = (fields: ReadonlyArray<unknown>, name: string) =>
  pipe(
    fields.find((field) => isRecord(field) && field.field_name === name),
    Option.fromNullable,
  );

const withFieldName = (fieldName: string, input: unknown) =>
  isRecord(input) ? Data.struct({ ...input, field_name: fieldName }) : input;

const getProperty = (input: unknown, property: string) =>
  isRecord(input) ? Option.fromNullable(input[property]) : Option.none();

export const value = withSbor(Schema.Unknown, 'Tuple');

export const string = withSbor(
  Schema.transformOrFail(SborString, Schema.String, {
    strict: false,
    decode: (input) => Effect.succeed(input.value),
    encode: (input) =>
      Effect.succeed(Data.struct({ kind: 'String', value: input })),
  }),
  'String',
);

export const bool = withSbor(
  Schema.transformOrFail(SborBool, Schema.Boolean, {
    strict: false,
    decode: (input) => Effect.succeed(input.value),
    encode: (input) =>
      Effect.succeed(Data.struct({ kind: 'Bool', value: input })),
  }),
  'Bool',
);

export const bytes = withSbor(
  Schema.transformOrFail(SborBytes, Schema.String, {
    strict: false,
    decode: (input, _options, ast) =>
      input.element_kind === 'U8'
        ? Effect.succeed(input.hex)
        : fail(ast, input, 'Bytes element kind must be U8'),
    encode: (input) =>
      Effect.succeed(Data.struct({
        kind: 'Bytes',
        element_kind: 'U8',
        element_type_name: 'U8',
        hex: input,
      })),
  }),
  'Bytes',
);

const integer = (kind: IntegerKind) =>
  withSbor(
    Schema.transformOrFail(sborInteger(kind), Schema.instanceOf(BigNumber), {
      strict: false,
      decode: (input, _options, ast) => integerValue(kind, input.value, ast),
      encode: (input, _options, ast) => encodedInteger(kind, input, ast),
    }),
    kind,
  );

const decimalLike = (kind: DecimalKind) =>
  withSbor(
    Schema.transformOrFail(sborDecimal(kind), Schema.instanceOf(BigNumber), {
      strict: false,
      decode: (input, _options, ast) =>
        parseBigNumber(input.value, ast, input.value),
      encode: (input) =>
        Effect.succeed(Data.struct({ kind, value: input.toString(10) })),
    }),
    kind,
  );

export const u8 = integer('U8');
export const u16 = integer('U16');
export const u32 = integer('U32');
export const u64 = integer('U64');
export const u128 = integer('U128');
export const i8 = integer('I8');
export const i16 = integer('I16');
export const i32 = integer('I32');
export const i64 = integer('I64');
export const i128 = integer('I128');
export const decimal = decimalLike('Decimal');
export const preciseDecimal = decimalLike('PreciseDecimal');

export const number = withSbor(
  Schema.transformOrFail(Schema.Unknown, GenericNumericSchema, {
    strict: false,
    decode: (input, _options, ast) =>
      pipe(
        numericKind(input),
        Option.match({
          onNone: () => fail(ast, input, 'Expected numeric SBOR kind'),
          onSome: (kind) =>
            isRecord(input) && typeof input.value === 'string'
              ? pipe(
                  numericValue(kind, input.value, ast),
                  Effect.map((decoded) =>
                    Data.struct({ type: kind, value: decoded }),
                  ),
                )
              : fail(ast, input, 'Numeric value must be a string'),
        }),
      ),
    encode: (input, _options, ast) =>
      isIntegerKind(input.type)
        ? encodedInteger(input.type, input.value, ast)
        : Effect.succeed(Data.struct({
            kind: input.type,
            value: input.value.toString(10),
          })),
  }),
  'Decimal',
);

export const numeric = number;

export const instant = withSbor(
  Schema.transformOrFail(SborIntegerI64Instant, Schema.DateFromSelf, {
    strict: false,
    decode: (input, _options, ast) =>
      pipe(
        integerValue('I64', input.value, ast),
        Effect.map((seconds) => new Date(seconds.toNumber() * 1000)),
      ),
    encode: (input) =>
      Effect.succeed(Data.struct({
        kind: 'I64',
        type_name: 'Instant',
        value: Math.floor(input.getTime() / 1000).toString(),
      })),
  }),
  'I64',
  Option.some('Instant'),
);

function reference<const TypeName extends string, A extends string>(
  typeName: TypeName,
  schema: Schema.Schema<A, string>,
) {
  return withSbor(
    Schema.transformOrFail(SborReference, schema, {
      strict: false,
      decode: (input, _options, ast) =>
        input.type_name === typeName
          ? Effect.succeed(input.value)
          : fail(ast, input, `Expected Reference type_name ${typeName}`),
      encode: (input) =>
        Effect.succeed(
          Data.struct({ kind: 'Reference', type_name: typeName, value: input }),
        ),
    }),
    'Reference',
    Option.some(typeName),
  );
}

function own<const TypeName extends string, A extends string>(
  typeName: TypeName,
  schema: Schema.Schema<A, string>,
) {
  return withSbor(
    Schema.transformOrFail(SborOwn, schema, {
      strict: false,
      decode: (input, _options, ast) =>
        input.type_name === typeName
          ? Effect.succeed(input.value)
          : fail(ast, input, `Expected Own type_name ${typeName}`),
      encode: (input) =>
        Effect.succeed(
          Data.struct({ kind: 'Own', type_name: typeName, value: input }),
        ),
    }),
    'Own',
    Option.some(typeName),
  );
}

export const resourceAddress = reference('ResourceAddress', ResourceAddress);
export const componentAddress = reference('ComponentAddress', ComponentAddress);
export const accountAddress = reference('AccountAddress', AccountAddress);
export const packageAddress = reference('PackageAddress', PackageAddress);
export const nonFungibleResourceAddress = reference(
  'NonFungibleResourceAddress',
  NonFungibleResourceAddress,
);
export const internalAddress = own('InternalAddress', InternalAddress);
export const vaultAddress = own('Vault', VaultAddress);
export const keyValueStoreAddress = own(
  'KeyValueStore',
  KeyValueStoreAddress,
);

export const nonFungibleLocalId = withSbor(
  Schema.transformOrFail(
    Schema.Struct({
      ...baseFields,
      kind: Schema.Literal('NonFungibleLocalId'),
      value: Schema.String,
    }),
    NonFungibleLocalId,
    {
      strict: false,
      decode: (input) => Effect.succeed(input.value),
      encode: (input) =>
        Effect.succeed(
          Data.struct({ kind: 'NonFungibleLocalId', value: input }),
        ),
    },
  ),
  'NonFungibleLocalId',
);

export const struct = <const Fields extends Record<string, NativeSborSchema>>(
  fields: Fields,
) =>
  withSbor(
    Schema.transformOrFail(SborTuple, Schema.Struct(fields), {
      strict: false,
      decode: (input, _options, ast) =>
        pipe(
          Object.keys(fields),
          Effect.forEach((name) =>
            pipe(
              fieldByName(input.fields, name),
              Option.match({
                onNone: () => fail(ast, input, `Missing required field ${name}`),
                onSome: (field) => Effect.succeed([name, field]),
              }),
            ),
          ),
          Effect.map(Object.fromEntries),
        ),
      encode: (input) =>
        Effect.succeed({
          kind: 'Tuple',
          fields: Object.entries(input).map(([name, field]) =>
            withFieldName(name, field),
          ),
        }),
    }),
    'Tuple',
  );

export const tuple = <const Items extends ReadonlyArray<NativeSborSchema>>(
  items: Items,
) =>
  withSbor(
    Schema.transformOrFail(SborTuple, Schema.Tuple(...items), {
      strict: false,
      decode: (input, _options, ast) =>
        input.fields.length === items.length
          ? Effect.succeed(input.fields)
          : fail(
              ast,
              input,
              `Expected ${items.length} tuple fields, got ${input.fields.length}`,
            ),
      encode: (input) => Effect.succeed({ kind: 'Tuple', fields: input }),
    }),
    'Tuple',
  );

export const array = <Item extends NativeSborSchema>(item: Item) =>
  withSbor(
    Schema.transformOrFail(SborArray, Schema.Array(item), {
      strict: false,
      decode: (input) => Effect.succeed(input.elements),
      encode: (input) =>
        Effect.succeed({
          kind: 'Array',
          element_kind: item.sbor.kind,
          element_type_name: pipe(item.sbor.typeName, Option.getOrUndefined),
          elements: input,
        }),
    }),
    'Array',
  );

const None = Schema.Struct({ variant: Schema.Literal('None') });

export const option = <Item extends NativeSborSchema>(item: Item) =>
  withSbor(
    Schema.transformOrFail(
      SborEnum,
      Schema.Union(
        None,
        Schema.Struct({ variant: Schema.Literal('Some'), value: item }),
      ),
      {
        strict: false,
        decode: (input, _options, ast) =>
          input.variant_name === 'None'
            ? Effect.succeed({ variant: 'None' })
            : input.variant_name === 'Some' && input.fields.length === 1
              ? Effect.succeed({ variant: 'Some', value: input.fields[0] })
              : fail(ast, input, 'Option must be None or Some with one field'),
        encode: (input, _options, ast) =>
          pipe(
            getProperty(input, 'variant'),
            Option.match({
              onNone: () => fail(ast, input, 'Option encode input must have a variant'),
              onSome: (variant) =>
                variant === 'None'
                  ? Effect.succeed({
                      kind: 'Enum',
                      type_name: 'Option',
                      variant_id: '0',
                      variant_name: 'None',
                      fields: [],
                    })
                  : variant === 'Some'
                    ? Effect.succeed({
                        kind: 'Enum',
                        type_name: 'Option',
                        variant_id: '1',
                        variant_name: 'Some',
                        fields: pipe(
                          getProperty(input, 'value'),
                          Option.match({
                            onNone: () => [],
                            onSome: (value) => [value],
                          }),
                        ),
                      })
                    : fail(ast, input, 'Option encode input must be None or Some'),
            }),
          ),
      },
    ),
    'Enum',
    Option.some('Option'),
  );

export const map = <
  Key extends NativeSborSchema,
  Value extends NativeSborSchema,
>(definition: {
  readonly key: Key;
  readonly value: Value;
}) =>
  withSbor(
    Schema.transformOrFail(
      SborMap,
      Schema.ReadonlyMap({ key: definition.key, value: definition.value }),
      {
        strict: false,
        decode: (input) =>
          Effect.succeed(
            input.entries.map((entry) => [entry.key, entry.value]),
          ),
        encode: (input) =>
          Effect.succeed({
            kind: 'Map',
            key_kind: definition.key.sbor.kind,
            key_type_name: pipe(
              definition.key.sbor.typeName,
              Option.getOrUndefined,
            ),
            value_kind: definition.value.sbor.kind,
            value_type_name: pipe(
              definition.value.sbor.typeName,
              Option.getOrUndefined,
            ),
            entries: input.map(([key, value]) => ({ key, value })),
          }),
      },
    ),
    'Map',
  );

export const enumeration = <const Variants extends ReadonlyArray<{
  readonly variant: string;
  readonly schema: NativeSborSchema;
}>>(
  variants: Variants,
) =>
  withSbor(
    Schema.transformOrFail(
      SborEnum,
      Schema.Struct({ variant: Schema.String, value: Schema.Unknown }),
      {
        strict: false,
        decode: (input, _options, ast) =>
          pipe(
            input.variant_name,
            Option.fromNullable,
            Option.flatMap((variantName) =>
              pipe(
                variants.find((variant) => variant.variant === variantName),
                Option.fromNullable,
              ),
            ),
            Option.match({
              onNone: () =>
                fail(ast, input, 'Unknown or missing enum variant'),
              onSome: (variant) =>
                Effect.succeed({
                  variant: variant.variant,
                  value: {
                    kind: 'Tuple',
                    fields: input.fields,
                    type_name: input.type_name,
                  },
                }),
            }),
          ),
        encode: (input, _options, ast) =>
          pipe(
            variants.find((variant) => variant.variant === input.variant),
            Option.fromNullable,
            Option.match({
              onNone: () => fail(ast, input, 'Unknown enum variant'),
              onSome: (variant) =>
                Effect.succeed({
                  kind: 'Enum',
                  variant_id: variants.indexOf(variant).toString(),
                  variant_name: input.variant,
                  fields: isRecord(input.value) && Array.isArray(input.value.fields)
                    ? input.value.fields
                    : [],
                }),
            }),
          ),
      },
    ),
    'Enum',
  );

export const s = {
  value,
  string,
  bool,
  bytes,
  u8,
  u16,
  u32,
  u64,
  u128,
  i8,
  i16,
  i32,
  i64,
  i128,
  decimal,
  preciseDecimal,
  number,
  numeric,
  instant,
  resourceAddress,
  componentAddress,
  accountAddress,
  packageAddress,
  nonFungibleResourceAddress,
  internalAddress,
  vaultAddress,
  keyValueStoreAddress,
  nonFungibleLocalId,
  struct,
  tuple,
  array,
  option,
  map,
  enum: enumeration,
};
