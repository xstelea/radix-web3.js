import type { ProgrammaticScryptoSborValue } from '@radixdlt/babylon-gateway-api-sdk';
import { Effect } from 'effect';
import {
  getSborKind,
  isSborRecord,
  sborFail,
  SborError,
  SborSchema,
} from '../sborSchema';

type SborKind = ProgrammaticScryptoSborValue['kind'];

// Add this new class alongside your existing schemas
export class NumberSchema extends SborSchema<number> {
  constructor() {
    const validKinds: SborKind[] = [
      'U8',
      'U16',
      'U32',
      'U64',
      'U128', // Unsigned integers
      'I8',
      'I16',
      'I32',
      'I64',
      'I128', // Signed integers
    ];
    super(validKinds);
  }

  validate(value: unknown, path: string[]) {
    const self = this;
    return Effect.gen(function* () {
      const kind = getSborKind(value);
      if (!kind || !self.kinds.includes(kind)) {
        return yield* sborFail(
          `Invalid number kind. Expected one of ${self.kinds.join(', ')}, got ${kind ?? 'unknown'}`,
          path,
        );
      }

      if (!isSborRecord(value) || typeof value.value !== 'string') {
        return yield* sborFail('Number value must be a string', path);
      }

      const num = yield* parseBigInt(value.value, path);

      if (kind.startsWith('U') && num < 0) {
        return yield* sborFail('Unsigned integer cannot be negative', path);
      }

      const range = ranges[kind as keyof typeof ranges];
      if (num < range.min || num > range.max) {
        return yield* sborFail(
          `Number out of range for ${kind}. Must be between ${range.min} and ${range.max}`,
          path,
        );
      }
    });
  }

  parse(value: unknown, path: string[]) {
    const self = this;
    return Effect.gen(function* () {
      yield* self.validate(value, path);
      if (!isSborRecord(value) || typeof value.value !== 'string') {
        return yield* sborFail('Number value must be a string', path);
      }
      return Number(value.value);
    });
  }
}

const ranges = {
  U8: { min: 0n, max: 255n },
  U16: { min: 0n, max: 65535n },
  U32: { min: 0n, max: 4294967295n },
  U64: { min: 0n, max: 18446744073709551615n },
  U128: { min: 0n, max: 340282366920938463463374607431768211455n },
  I8: { min: -128n, max: 127n },
  I16: { min: -32768n, max: 32767n },
  I32: { min: -2147483648n, max: 2147483647n },
  I64: { min: -9223372036854775808n, max: 9223372036854775807n },
  I128: {
    min: -170141183460469231731687303715884105728n,
    max: 170141183460469231731687303715884105727n,
  },
};

const parseBigInt = (value: string, path: string[]) =>
  Effect.try({
    try: () => BigInt(value),
    catch: () =>
      new SborError({
        message: 'Number value must be a valid integer string',
        path,
      }),
  });
