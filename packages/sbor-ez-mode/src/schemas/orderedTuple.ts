import { Effect } from 'effect';
import { isSborKind, sborFail, SborSchema } from '../sborSchema';

export type TupleSchema = SborSchema<unknown>[];

export class OrderedTupleSchema<T extends TupleSchema> extends SborSchema<{
  [K in keyof T]: T[K] extends SborSchema<infer U> ? U : never;
}> {
  public schemas: T;

  constructor(schemas: T) {
    super(['Tuple']);
    this.schemas = schemas;
  }

  validate(value: unknown, path: string[]) {
    if (!isSborKind(value, 'Tuple')) {
      return sborFail('The object is not a tuple', path);
    }

    const fields = value.fields;

    if (fields.length !== this.schemas.length) {
      return sborFail(
        `Expected ${this.schemas.length} fields, got ${fields.length}`,
        path,
      );
    }

    return Effect.forEach(this.schemas, (schema, index) => {
      const field = fields[index];
      if (!field)
        return sborFail(`Missing field at index ${index}`, [
          ...path,
          index.toString(),
        ]);
      if (!schema) {
        return sborFail(`Schema not found for field at index ${index}`, [
          ...path,
          index.toString(),
        ]);
      }

      if (!schema.kinds.includes(field.kind)) {
        return sborFail(`Expected kind ${schema.kinds}, got ${field.kind}`, [
          ...path,
          index.toString(),
        ]);
      }

      return schema.validate(field, [...path, index.toString()]);
    }).pipe(Effect.asVoid);
  }

  parse(value: unknown, path: string[]) {
    const self = this;
    return Effect.gen(function* () {
      yield* self.validate(value, path);
      if (!isSborKind(value, 'Tuple')) {
        return yield* sborFail('The object is not a tuple', path);
      }

      const parsed = yield* Effect.forEach(value.fields, (field, index) => {
        const schema = self.schemas[index];
        if (!schema) {
          return sborFail(`Schema not found for field at index ${index}`, [
            ...path,
            index.toString(),
          ]);
        }
        return schema.parse(field, [...path, index.toString()]);
      });

      return parsed as {
        [K in keyof T]: T[K] extends SborSchema<infer U> ? U : never;
      };
    });
  }
}
