import type { ProgrammaticScryptoSborValue } from '@radixdlt/babylon-gateway-api-sdk';
import { Effect, Either, Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import { s } from './factory';
import { SborError, type SborSchema } from './sborSchema';

const parseFailure = (
  schema: SborSchema<unknown>,
  value: ProgrammaticScryptoSborValue,
) => {
  const result = Effect.runSync(Effect.either(schema.safeParse(value)));
  expect(Either.isLeft(result)).toBe(true);
  if (Either.isRight(result)) {
    throw new Error('Expected SBOR parse failure');
  }
  return result.left;
};

describe('SborSchema safeParse', () => {
  it('returns an Effect that fails with a schema-backed SborError', () => {
    const error = parseFailure(s.string(), { kind: 'Bool', value: true });

    expect(error).toBeInstanceOf(SborError);
    expect(error).toMatchObject({
      _tag: 'SborError',
      message: 'Invalid string',
      path: [],
    });
    expect(Schema.decodeUnknownSync(SborError)(error)).toMatchObject({
      _tag: 'SborError',
      message: 'Invalid string',
      path: [],
    });
  });

  it('exposes an Effect Schema transform decoder', () => {
    const decoded = Effect.runSync(
      Schema.decodeUnknown(s.string().effectSchema)({
        kind: 'String',
        value: 'decoded through Schema',
      }),
    );

    expect(decoded).toBe('decoded through Schema');
  });

  it.each([
    [
      'bool',
      s.bool(),
      { kind: 'String', value: 'true' } as ProgrammaticScryptoSborValue,
      'Invalid boolean',
    ],
    [
      'bytes',
      s.bytes(),
      { kind: 'String', value: 'ff' } as ProgrammaticScryptoSborValue,
      'Invalid bytes',
    ],
    [
      'decimal',
      s.decimal(),
      { kind: 'String', value: '1.23' } as ProgrammaticScryptoSborValue,
      'The Kind of this value is not Decimal or PreciseDecimal',
    ],
    [
      'address',
      s.address(),
      {
        kind: 'String',
        value: 'resource_rdx1...',
      } as ProgrammaticScryptoSborValue,
      'Invalid reference',
    ],
    [
      'internalAddress',
      s.internalAddress(),
      {
        kind: 'Reference',
        value: 'internal_vault_rdx1...',
      } as ProgrammaticScryptoSborValue,
      'Invalid reference',
    ],
    [
      'nonFungibleLocalId',
      s.nonFungibleLocalId(),
      { kind: 'String', value: '#1#' } as ProgrammaticScryptoSborValue,
      'Invalid nonfungiblelocalid',
    ],
  ])('%s reports invalid primitive shape', (_, schema, value, message) => {
    const error = parseFailure(schema, value);
    expect(error.message).toBe(message);
    expect(error.path).toEqual([]);
  });

  it('reports nested struct field paths', () => {
    const schema = s.struct({
      outer: s.struct({
        count: s.number(),
      }),
    });

    const error = parseFailure(schema, {
      kind: 'Tuple',
      fields: [
        {
          kind: 'Tuple',
          field_name: 'outer',
          fields: [{ kind: 'String', field_name: 'count', value: 'one' }],
        },
      ],
    });

    expect(error.message).toBe(
      'Expected kind U8,U16,U32,U64,U128,I8,I16,I32,I64,I128 for field count, got String',
    );
    expect(error.path).toEqual(['outer', 'count']);
  });

  it('reports missing required struct fields', () => {
    const error = parseFailure(s.struct({ required: s.string() }), {
      kind: 'Tuple',
      fields: [],
    });

    expect(error.message).toBe('Missing required fields: required');
    expect(error.path).toEqual([]);
  });

  it('reports array item paths', () => {
    const error = parseFailure(s.array(s.number()), {
      kind: 'Array',
      element_kind: 'U32',
      elements: [
        { kind: 'U32', value: '1' },
        { kind: 'String', value: '2' },
      ],
    });

    expect(error.message).toBe(
      'Invalid number kind. Expected one of U8, U16, U32, U64, U128, I8, I16, I32, I64, I128, got String',
    );
    expect(error.path).toEqual(['1']);
  });

  it('reports map entry paths', () => {
    const error = parseFailure(s.map({ key: s.string(), value: s.bool() }), {
      kind: 'Map',
      key_kind: 'String',
      value_kind: 'Bool',
      entries: [
        {
          key: { kind: 'String', value: 'enabled' },
          value: { kind: 'String', value: 'true' },
        },
      ],
    });

    expect(error.message).toBe('Invalid boolean');
    expect(error.path).toEqual(['0']);
  });

  it('reports unknown enum variants', () => {
    const error = parseFailure(
      s.enum([{ variant: 'Known', schema: s.tuple([]) }]),
      {
        kind: 'Enum',
        variant_id: '1',
        variant_name: 'Unknown',
        fields: [],
      },
    );

    expect(error.message).toBe('Unknown variant: Unknown');
    expect(error.path).toEqual([]);
  });

  it('reports invalid option variants', () => {
    const error = parseFailure(s.option(s.string()), {
      kind: 'Enum',
      variant_id: '2',
      variant_name: 'Other',
      fields: [],
    });

    expect(error.message).toBe('Invalid enum variant');
    expect(error.path).toEqual([]);
  });

  it('normalizes unexpected parser exceptions into SborError', () => {
    const error = parseFailure(s.number(), {
      kind: 'U32',
      value: 'not-a-number',
    });

    expect(error).toBeInstanceOf(SborError);
    expect(error.message).toBe('Number value must be a valid integer string');
    expect(error.path).toEqual([]);
  });
});
