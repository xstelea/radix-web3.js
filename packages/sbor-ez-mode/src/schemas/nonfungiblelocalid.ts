import { Effect } from 'effect';
import { isSborKind, sborFail, SborSchema } from '../sborSchema';

export class NonFungibleLocalIdSchema extends SborSchema<string> {
  constructor() {
    super(['NonFungibleLocalId']);
  }

  validate(value: unknown, path: string[]) {
    if (!isSborKind(value, 'NonFungibleLocalId')) {
      return sborFail('Invalid nonfungiblelocalid', path);
    }
    return Effect.void;
  }

  parse(value: unknown, path: string[]) {
    const self = this;
    return Effect.gen(function* () {
      yield* self.validate(value, path);
      if (!isSborKind(value, 'NonFungibleLocalId')) {
        return yield* sborFail('Invalid nonfungiblelocalid', path);
      }
      return value.value;
    });
  }
}
