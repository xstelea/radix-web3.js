import { Effect } from 'effect';
import { isSborKind, sborFail, SborSchema } from '../sborSchema';

// Primitive schemas
export class BytesSchema extends SborSchema<string> {
  constructor() {
    super(['Bytes']);
  }

  validate(value: unknown, path: string[]) {
    if (!isSborKind(value, 'Bytes')) {
      return sborFail('Invalid bytes', path);
    }
    if (value.element_type_name !== 'U8') {
      return sborFail('Invalid bytes element type', path);
    }
    return Effect.void;
  }

  parse(value: unknown, path: string[]) {
    const self = this;
    return Effect.gen(function* () {
      yield* self.validate(value, path);
      if (!isSborKind(value, 'Bytes')) {
        return yield* sborFail('Invalid bytes', path);
      }
      return value.hex;
    });
  }
}
