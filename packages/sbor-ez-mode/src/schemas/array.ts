import { Effect } from 'effect';
import { isSborKind, sborFail, SborError, SborSchema } from '../sborSchema';

export class ArraySchema<T> extends SborSchema<T[]> {
  public itemSchema: SborSchema<T>;

  constructor(itemSchema: SborSchema<T>) {
    super(['Array']);
    this.itemSchema = itemSchema;
  }

  validate(value: unknown, path: string[]) {
    if (!isSborKind(value, 'Array')) {
      return sborFail('Invalid array structure', path);
    }

    return Effect.forEach(value.elements, (item, index) =>
      this.itemSchema.validate(item, [...path, index.toString()]),
    ).pipe(Effect.asVoid);
  }

  parse(value: unknown, path: string[]): Effect.Effect<T[], SborError> {
    const self = this;
    return Effect.gen(function* () {
      yield* self.validate(value, path);
      if (!isSborKind(value, 'Array')) {
        return yield* sborFail('Invalid array structure', path);
      }
      return yield* Effect.forEach(value.elements, (item, index) =>
        self.itemSchema.parse(item, [...path, index.toString()]),
      );
    });
  }
}
