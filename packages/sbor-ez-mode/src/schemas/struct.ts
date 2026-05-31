import { Effect } from 'effect';
import { isSborKind, sborFail, SborSchema } from '../sborSchema';

// Tuple schema (acting like a struct)
export interface StructDefinition {
  [key: string]: SborSchema<unknown>;
}

export type ParsedType<T extends SborSchema<unknown>> = T extends SborSchema<
  infer U
>
  ? U
  : never;

export class StructSchema<
  T extends StructDefinition,
  O extends boolean = false,
> extends SborSchema<{
  [K in keyof T]: O extends true ? ParsedType<T[K]> | null : ParsedType<T[K]>;
}> {
  public definition: T;
  private allowMissing: O;

  /**
   * @param definition The struct definition.
   * @param allowMissing If true, missing fields are allowed and parsed as `null`;
   *                     if false, missing fields will be a parsing error.
   */
  constructor(definition: T, allowMissing: O) {
    super(['Tuple']);
    this.definition = definition;
    this.allowMissing = allowMissing;
  }

  validate(value: unknown, path: string[]) {
    if (!isSborKind(value, 'Tuple')) {
      return sborFail('Invalid tuple structure', path);
    }

    const fields = value.fields;
    const definedFields = Object.keys(this.definition);

    // If missing fields are not allowed, check for their existence.
    if (!this.allowMissing) {
      const fieldNames = fields.map((f) => f.field_name).filter(Boolean);
      const missingFields = definedFields.filter(
        (name) => !fieldNames.includes(name),
      );
      if (missingFields.length > 0) {
        return sborFail(
          `Missing required fields: ${missingFields.join(', ')}`,
          path,
        );
      }
    }

    const self = this;
    return Effect.forEach(definedFields, (name) =>
      Effect.gen(function* () {
        const field = fields.find((f) => f.field_name === name);
        if (!field) {
          if (!self.allowMissing) {
            return yield* sborFail(`Missing field: ${name}`, [...path, name]);
          }
          return;
        }

        const schema = self.definition[name];
        if (!schema) {
          return yield* sborFail(`Schema not found for field ${name}`, [
            ...path,
            name,
          ]);
        }
        if (!schema.kinds.includes(field.kind)) {
          return yield* sborFail(
            `Expected kind ${schema.kinds} for field ${name}, got ${field.kind}`,
            [...path, name],
          );
        }
        yield* schema.validate(field, [...path, name]);
      }),
    ).pipe(Effect.asVoid);
  }

  parse(value: unknown, path: string[]) {
    const self = this;
    return Effect.gen(function* () {
      yield* self.validate(value, path);
      if (!isSborKind(value, 'Tuple')) {
        return yield* sborFail('Invalid tuple structure', path);
      }

      const result: Partial<{ [K in keyof T]: ParsedType<T[K]> | null }> = {};

      for (const [name, schema] of Object.entries(self.definition)) {
        if (!schema) {
          return yield* sborFail(`Schema not found for field ${name}`, [
            ...path,
            name,
          ]);
        }
        const field = value.fields.find((f) => f.field_name === name);
        if (field) {
          result[name as keyof T] = (yield* schema.parse(field, [
            ...path,
            name,
          ])) as ParsedType<T[typeof name]>;
        } else {
          result[name as keyof T] = null;
        }
      }

      return result as {
        [K in keyof T]: O extends true
          ? ParsedType<T[K]> | null
          : ParsedType<T[K]>;
      };
    });
  }
}
