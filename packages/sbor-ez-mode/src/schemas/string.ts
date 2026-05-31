import { Effect } from 'effect';
import { isSborKind, sborFail, SborSchema } from '../sborSchema';

export class StringSchema extends SborSchema<string> {
  constructor() {
    super(['String']);
  }

  validate(value: unknown, path: string[]) {
    if (!isSborKind(value, 'String') || typeof value.value !== 'string') {
      return sborFail('Invalid string', path);
    }
    return Effect.void;
  }

  parse(value: unknown, path: string[]) {
    const self = this;
    return Effect.gen(function* () {
      yield* self.validate(value, path);
      if (!isSborKind(value, 'String')) {
        return yield* sborFail('Invalid string', path);
      }
      return value.value;
    });
  }
}
