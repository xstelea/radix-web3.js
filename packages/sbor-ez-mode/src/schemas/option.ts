import { Effect } from 'effect';
import { isSborKind, sborFail, SborSchema } from '../sborSchema';

export class OptionSchema<T extends SborSchema<unknown>> extends SborSchema<
  | {
      variant: 'Some';
      value: T extends SborSchema<infer O> ? O : never;
    }
  | {
      variant: 'None';
    }
> {
  public innerSchema: T;

  constructor(innerSchema: T) {
    super(['Enum']);
    this.innerSchema = innerSchema;
  }
  validate(value: unknown, path: string[]) {
    if (!isSborKind(value, 'Enum')) {
      return sborFail('Invalid enum structure', path);
    }

    if (value.variant_name === 'None') {
      if (value.fields.length !== 0) {
        return sborFail('Invalid enum None variant', path);
      }
      return Effect.void;
    }

    if (value.variant_name !== 'Some') {
      return sborFail('Invalid enum variant', path);
    }
    if (value.fields.length !== 1) {
      return sborFail('Invalid enum Some variant', path);
    }
    const field = value.fields[0];
    if (!field) {
      return sborFail('Missing field in Some variant', path);
    }
    return this.innerSchema.validate(field, path);
  }

  parse(value: unknown, path: string[]) {
    const self = this;
    return Effect.gen(function* () {
      yield* self.validate(value, path);
      if (!isSborKind(value, 'Enum')) {
        return yield* sborFail('Invalid enum structure', path);
      }
      if (value.variant_name === 'None') {
        return { variant: 'None' } as const;
      }
      const field = value.fields[0];
      if (!field) {
        return yield* sborFail('Missing field in Some variant', path);
      }
      return {
        variant: 'Some',
        value: (yield* self.innerSchema.parse(
          field,
          path,
        )) as T extends SborSchema<infer O> ? O : never,
      } as const;
    });
  }
}
