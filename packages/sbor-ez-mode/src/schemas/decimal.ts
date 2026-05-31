import { Effect } from 'effect';
import { isSborKind, sborFail, SborSchema } from '../sborSchema';

// Primitive schemas
export class DecimalSchema extends SborSchema<string> {
  constructor() {
    super(['Decimal', 'PreciseDecimal']);
  }

  validate(value: unknown, path: string[]) {
    if (!isSborKind(value, 'Decimal') && !isSborKind(value, 'PreciseDecimal')) {
      return sborFail(
        'The Kind of this value is not Decimal or PreciseDecimal',
        path,
      );
    }
    return Effect.void;
  }

  parse(value: unknown, path: string[]) {
    const self = this;
    return Effect.gen(function* () {
      yield* self.validate(value, path);
      if (
        !isSborKind(value, 'Decimal') &&
        !isSborKind(value, 'PreciseDecimal')
      ) {
        return yield* sborFail(
          'The Kind of this value is not Decimal or PreciseDecimal',
          path,
        );
      }
      return value.value;
    });
  }
}
