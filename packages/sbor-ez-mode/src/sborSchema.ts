import type { ProgrammaticScryptoSborValue } from '@radixdlt/babylon-gateway-api-sdk';
import { Effect, ParseResult, Schema } from 'effect';

// Schema and parsing errors
export class SborError extends Schema.TaggedError<SborError>()('SborError', {
  message: Schema.String,
  path: Schema.Array(Schema.String),
}) {}

export const kinds: [
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
] = [
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
];

export type SborKind = ProgrammaticScryptoSborValue['kind'];
// Base schema class
export abstract class SborSchema<T> {
  readonly kinds: SborKind[];
  readonly effectSchema: Schema.Schema<unknown, unknown>;

  constructor(kinds: SborKind[]) {
    this.kinds = kinds;
    this.effectSchema = Schema.transformOrFail(Schema.Unknown, Schema.Any, {
      strict: false,
      decode: (value, _options, ast) =>
        this.parse(value, []).pipe(
          Effect.mapError(
            (error) =>
              new ParseResult.Type(
                ast,
                value,
                `${error.message} at ${formatPath(error.path)}`,
              ),
          ),
        ),
      encode: (value) => Effect.succeed(value),
    });
  }

  abstract validate(
    value: unknown,
    path: string[],
  ): Effect.Effect<void, SborError>;

  abstract parse(value: unknown, path: string[]): Effect.Effect<T, SborError>;

  safeParse(value: ProgrammaticScryptoSborValue): Effect.Effect<T, SborError> {
    return this.parse(value, []);
  }
}

export const sborFail = (message: string, path: string[]) =>
  Effect.fail(new SborError({ message, path }));

export const isSborRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const getSborKind = (value: unknown): SborKind | undefined => {
  if (!isSborRecord(value) || typeof value.kind !== 'string') {
    return undefined;
  }
  return kinds.includes(value.kind as SborKind)
    ? (value.kind as SborKind)
    : undefined;
};

export const isSborKind = <K extends SborKind>(
  value: unknown,
  kind: K,
): value is Extract<ProgrammaticScryptoSborValue, { kind: K }> =>
  getSborKind(value) === kind;

export const formatPath = (path: readonly string[]) =>
  path.length === 0 ? '<root>' : path.join('.');
