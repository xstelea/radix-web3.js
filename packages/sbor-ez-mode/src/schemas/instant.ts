import { Effect } from 'effect';
import {
  isSborKind,
  isSborRecord,
  sborFail,
  SborError,
  SborSchema,
} from '../sborSchema';

// Add this new class alongside your existing schemas
export class InstantSchema extends SborSchema<Date> {
  constructor() {
    super(['I64']);
  }

  validate(value: unknown, path: string[]) {
    return Effect.gen(function* () {
      if (!isSborKind(value, 'I64')) {
        return yield* sborFail('Invalid number kind. Expected an I64', path);
      }

      if (typeof value.value !== 'string') {
        return yield* sborFail('Number value must be a string', path);
      }

      const num = yield* parseBigInt(value.value, path);
      const range = { min: -9223372036854775808n, max: 9223372036854775807n };

      if (num < range.min || num > range.max) {
        return yield* sborFail(
          `Number out of range for ${value.kind}. Must be between ${range.min} and ${range.max}`,
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
      return new Date(Number(value.value) * 1000);
    });
  }
}

const parseBigInt = (value: string, path: string[]) => {
  return Effect.try({
    try: () => BigInt(value),
    catch: () =>
      new SborError({
        message: 'Number value must be a valid integer string',
        path,
      }),
  });
};
