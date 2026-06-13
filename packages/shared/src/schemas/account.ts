import { Schema, SchemaGetter } from 'effect';

import { AccessControllerAddress, AccountAddress } from '../brandedTypes';

export const UnsecurifiedAccountDecodedSchema = Schema.Struct({
  type: Schema.Literal('unsecurifiedAccount'),
  address: AccountAddress,
});

export const UnsecurifiedAccountSchema = Schema.Struct({
  type: Schema.optional(Schema.Literal('unsecurifiedAccount')),
  address: Schema.String,
}).pipe(
  Schema.decodeTo(UnsecurifiedAccountDecodedSchema, {
    decode: SchemaGetter.transform((value) => ({
      type: 'unsecurifiedAccount' as const,
      address: AccountAddress.make(value.address),
    })),
    encode: SchemaGetter.transform((value) => ({
      type: 'unsecurifiedAccount' as const,
      address: value.address,
    })),
  }),
);

export const SecurifiedAccountDecodedSchema = Schema.Struct({
  type: Schema.Literal('securifiedAccount'),
  address: AccountAddress,
  accessControllerAddress: AccessControllerAddress,
});

export const SecurifiedAccountSchema = Schema.Struct({
  type: Schema.optional(Schema.Literal('securifiedAccount')),
  address: Schema.String,
  accessControllerAddress: Schema.String,
}).pipe(
  Schema.decodeTo(SecurifiedAccountDecodedSchema, {
    decode: SchemaGetter.transform((value) => ({
      type: 'securifiedAccount' as const,
      address: AccountAddress.make(value.address),
      accessControllerAddress: AccessControllerAddress.make(
        value.accessControllerAddress,
      ),
    })),
    encode: SchemaGetter.transform((value) => ({
      type: 'securifiedAccount' as const,
      address: value.address,
      accessControllerAddress: value.accessControllerAddress,
    })),
  }),
);

export const AccountSchema = Schema.Union([
  UnsecurifiedAccountSchema,
  SecurifiedAccountSchema,
]);

export type UnsecurifiedAccount = typeof UnsecurifiedAccountSchema.Type;
export type SecurifiedAccount = typeof SecurifiedAccountSchema.Type;
export type Account = typeof AccountSchema.Type;
