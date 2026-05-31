import { Effect } from 'effect';
import { isSborKind, sborFail, SborSchema } from '../sborSchema';

export class AddressSchema extends SborSchema<string> {
  constructor() {
    super(['Reference']);
  }

  validate(value: unknown, path: string[]) {
    if (!isSborKind(value, 'Reference')) {
      return sborFail('Invalid reference', path);
    }
    if (typeof value.value !== 'string') {
      return sborFail('Invalid resource address', path);
    }
    return Effect.void;
  }

  parse(value: unknown, path: string[]) {
    const self = this;
    return Effect.gen(function* () {
      yield* self.validate(value, path);
      if (!isSborKind(value, 'Reference')) {
        return yield* sborFail('Invalid reference', path);
      }
      return value.value;
    });
  }
}
