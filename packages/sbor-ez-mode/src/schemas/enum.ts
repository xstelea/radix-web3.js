import type { ProgrammaticScryptoSborValueTuple } from '@radixdlt/babylon-gateway-api-sdk';
import { Effect } from 'effect';
import { isSborKind, sborFail, SborError, SborSchema } from '../sborSchema';
import type { OrderedTupleSchema } from './orderedTuple'; // Assuming you have this from your previous code
import type { ParsedType, StructSchema } from './struct'; // Assuming you have this from your previous code

export interface VariantDefinition<
  S extends StructSchema<any, any> | OrderedTupleSchema<any>,
> {
  variant: string;
  schema: S;
}

// Helper types to extract parsed and output types from variant schemas
type VariantParsedType<T extends VariantDefinition<any>> =
  T['schema'] extends StructSchema<infer U, any>
    ? { [K in keyof U]: ParsedType<U[K]> }
    : T['schema'] extends OrderedTupleSchema<infer U>
      ? { [K in keyof U]: ParsedType<U[K]> }
      : never;

export type EnumParsedType<T extends VariantDefinition<any>[]> = {
  [K in keyof T]: T[K] extends VariantDefinition<infer S>
    ? S extends StructSchema<any, any>
      ? {
          variant: T[K]['variant'];
          value: VariantParsedType<T[K]>;
        }
      : S extends OrderedTupleSchema<any>
        ? { variant: T[K]['variant']; value: VariantParsedType<T[K]> }
        : never
    : never;
}[number];

export class EnumSchema<T extends VariantDefinition<any>[]> extends SborSchema<
  {
    [K in keyof T]: T[K] extends VariantDefinition<any>
      ? { variant: T[K]['variant']; value: VariantParsedType<T[K]> }
      : never;
  }[number]
> {
  public variants: Map<string, VariantDefinition<any>>;

  constructor(variants: T) {
    super(['Enum']);
    this.variants = new Map(variants.map((v) => [v.variant, v]));
  }
  validate(value: unknown, path: string[]) {
    if (!isSborKind(value, 'Enum')) {
      return sborFail('Invalid enum structure', path);
    }

    // Validate variant exists
    const variantName = value.variant_name;
    if (!variantName || !this.variants.has(variantName)) {
      return sborFail(`Unknown variant: ${variantName || 'undefined'}`, path);
    }

    const variantDef = this.variants.get(variantName)!;

    // If the variant has no schema (empty variant), fields should be empty
    if (!variantDef.schema) {
      if (value.fields.length > 0) {
        return sborFail(
          `Empty variant ${variantName} should have no fields`,
          path,
        );
      }
      return Effect.void;
    }

    // Validate the variant's contents using its schema
    const tupleValue: ProgrammaticScryptoSborValueTuple = {
      kind: 'Tuple',
      fields: value.fields,
      field_name: value.field_name,
      type_name: value.type_name,
    };
    return variantDef.schema.validate(tupleValue, [...path, variantName]);
  }

  parse(
    value: unknown,
    path: string[],
  ): Effect.Effect<EnumParsedType<T>, SborError> {
    const self = this;
    return Effect.gen(function* () {
      yield* self.validate(value, path);
      if (!isSborKind(value, 'Enum')) {
        return yield* sborFail('Invalid enum structure', path);
      }
      const variantName = value.variant_name!;
      const variantDef = self.variants.get(variantName)!;

      if (!variantDef.schema) {
        return { variant: variantName } as EnumParsedType<T>;
      }

      const tupleValue: ProgrammaticScryptoSborValueTuple = {
        kind: 'Tuple',
        fields: value.fields,
        field_name: value.field_name,
        type_name: value.type_name,
      };
      return {
        variant: variantName,
        value: yield* variantDef.schema.parse(tupleValue, [
          ...path,
          variantName,
        ]),
      } as EnumParsedType<T>;
    }) as Effect.Effect<EnumParsedType<T>, SborError>;
  }
}
