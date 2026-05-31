import { Effect } from 'effect';
import { isSborKind, sborFail, SborSchema } from '../sborSchema';

// Primitive schemas
export class BoolSchema extends SborSchema<boolean> {
  constructor() {
    super(['Bool']);
  }

  validate(value: unknown, path: string[]) {
    if (!isSborKind(value, 'Bool')) {
      return sborFail('Invalid boolean', path);
    }
    if (typeof value.value !== 'boolean') {
      return sborFail('Invalid boolean value', path);
    }
    return Effect.void;
  }

  parse(value: unknown, path: string[]) {
    const self = this;
    return Effect.gen(function* () {
      yield* self.validate(value, path);
      if (!isSborKind(value, 'Bool')) {
        return yield* sborFail('Invalid boolean', path);
      }
      return value.value;
    });
  }
}
