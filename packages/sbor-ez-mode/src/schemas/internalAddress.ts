import { Effect } from 'effect';
import { isSborKind, sborFail, SborSchema } from '../sborSchema';

export class InternalAddressSchema extends SborSchema<string> {
  constructor() {
    super(['Own']);
  }

  validate(value: unknown, path: string[]) {
    if (!isSborKind(value, 'Own')) {
      return sborFail('Invalid reference', path);
    }
    if (typeof value.value !== 'string') {
      return sborFail('Invalid owned value', path);
    }
    return Effect.void;
  }

  parse(value: unknown, path: string[]) {
    const self = this;
    return Effect.gen(function* () {
      yield* self.validate(value, path);
      if (!isSborKind(value, 'Own')) {
        return yield* sborFail('Invalid owned value', path);
      }
      return value.value;
    });
  }
}
