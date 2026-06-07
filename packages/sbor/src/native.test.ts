import { assert, describe, expect, expectTypeOf, it } from '@effect/vitest';
import {
  AccountAddress,
  ComponentAddress,
  InternalAddress,
  KeyValueStoreAddress,
  NonFungibleLocalId,
  NonFungibleResourceAddress,
  PackageAddress,
  ResourceAddress,
  VaultAddress,
} from '@radix-effects/shared';
import type { ProgrammaticScryptoSborValue } from '@radixdlt/babylon-gateway-api-sdk';
import { BigNumber } from 'bignumber.js';
import { Effect, Either, type Schema } from 'effect';
import {
  type NativeSborSchema,
  accountAddress,
  array,
  bool,
  bytes,
  componentAddress,
  decimal,
  decode as decodeSbor,
  encode as encodeSbor,
  enumeration,
  i8,
  i16,
  i32,
  i64,
  i128,
  instant,
  internalAddress,
  keyValueStoreAddress,
  map,
  nonFungibleLocalId,
  nonFungibleResourceAddress,
  number,
  option,
  packageAddress,
  preciseDecimal,
  resourceAddress,
  s,
  string,
  struct,
  tuple,
  u8,
  u16,
  u32,
  u64,
  u128,
  value,
  vaultAddress,
} from './index';

const decodeFailure = <Decoded, Encoded>(
  schema: NativeSborSchema<Decoded, Encoded>,
  input: unknown,
) => Effect.either(decodeSbor(schema)(input));

const encodeFailure = <Decoded, Encoded>(
  schema: NativeSborSchema<Decoded, Encoded>,
  input: Decoded,
) => Effect.either(encodeSbor(schema)(input));

describe('native SBOR Effect schemas', () => {
  it.effect(
    'exposes curried decode and encode helpers for migration adapters',
    () =>
      Effect.gen(function* () {
        const Event = struct({
          resource: resourceAddress,
          amount: decimal,
        });

        const parsed = yield* decodeSbor(Event)({
          kind: 'Tuple',
          fields: [
            {
              kind: 'Reference',
              type_name: 'ResourceAddress',
              field_name: 'resource',
              value: 'resource_rdx1...',
            },
            {
              kind: 'Decimal',
              field_name: 'amount',
              value: '10',
            },
          ],
        });

        expectTypeOf(parsed).not.toBeAny();
        expectTypeOf(parsed).toEqualTypeOf<{
          readonly resource: ResourceAddress;
          readonly amount: BigNumber;
        }>();
        expect(parsed.amount.toString()).toBe('10');
        expect(yield* encodeSbor(Event)(parsed)).toEqual({
          kind: 'Tuple',
          fields: [
            {
              kind: 'Reference',
              type_name: 'ResourceAddress',
              field_name: 'resource',
              value: 'resource_rdx1...',
            },
            {
              kind: 'Decimal',
              field_name: 'amount',
              value: '10',
            },
          ],
        });
      }),
  );

  it.effect('round trips primitive scalar schemas', () =>
    Effect.gen(function* () {
      const raw = { kind: 'String', value: 'raw' };

      expect(yield* decodeSbor(value)(raw)).toEqual(raw);
      expect(yield* encodeSbor(value)(raw)).toEqual(raw);
      expect(
        yield* decodeSbor(string)({ kind: 'String', value: 'hello' }),
      ).toBe('hello');
      expect(yield* encodeSbor(string)('hello')).toEqual({
        kind: 'String',
        value: 'hello',
      });
      expect(yield* decodeSbor(bool)({ kind: 'Bool', value: true })).toBe(true);
      expect(yield* encodeSbor(bool)(true)).toEqual({
        kind: 'Bool',
        value: true,
      });
      expect(
        yield* decodeSbor(bytes)({
          kind: 'Bytes',
          element_kind: 'U8',
          hex: 'deadbeef',
        }),
      ).toBe('deadbeef');
      expect(yield* encodeSbor(bytes)('deadbeef')).toEqual({
        kind: 'Bytes',
        element_kind: 'U8',
        element_type_name: 'U8',
        hex: 'deadbeef',
      });
    }),
  );

  it.effect('round trips every explicit numeric schema', () =>
    Effect.gen(function* () {
      expect(
        (yield* decodeSbor(u8)({ kind: 'U8', value: '255' })).toFixed(0),
      ).toBe('255');
      expect(yield* encodeSbor(u8)(new BigNumber(255))).toEqual({
        kind: 'U8',
        value: '255',
      });
      expect(
        (yield* decodeSbor(u16)({ kind: 'U16', value: '65535' })).toFixed(0),
      ).toBe('65535');
      expect(yield* encodeSbor(u16)(new BigNumber(65535))).toEqual({
        kind: 'U16',
        value: '65535',
      });
      expect(
        (yield* decodeSbor(u32)({ kind: 'U32', value: '4294967295' })).toFixed(
          0,
        ),
      ).toBe('4294967295');
      expect(yield* encodeSbor(u32)(new BigNumber('4294967295'))).toEqual({
        kind: 'U32',
        value: '4294967295',
      });
      expect(
        (yield* decodeSbor(u64)({
          kind: 'U64',
          value: '18446744073709551615',
        })).toFixed(0),
      ).toBe('18446744073709551615');
      expect(
        yield* encodeSbor(u64)(new BigNumber('18446744073709551615')),
      ).toEqual({
        kind: 'U64',
        value: '18446744073709551615',
      });
      expect(
        (yield* decodeSbor(u128)({
          kind: 'U128',
          value: '340282366920938463463374607431768211455',
        })).toFixed(0),
      ).toBe('340282366920938463463374607431768211455');
      expect(
        yield* encodeSbor(u128)(
          new BigNumber('340282366920938463463374607431768211455'),
        ),
      ).toEqual({
        kind: 'U128',
        value: '340282366920938463463374607431768211455',
      });
      expect(
        (yield* decodeSbor(i8)({ kind: 'I8', value: '-128' })).toFixed(0),
      ).toBe('-128');
      expect(yield* encodeSbor(i8)(new BigNumber(-128))).toEqual({
        kind: 'I8',
        value: '-128',
      });
      expect(
        (yield* decodeSbor(i16)({ kind: 'I16', value: '-32768' })).toFixed(0),
      ).toBe('-32768');
      expect(yield* encodeSbor(i16)(new BigNumber(-32768))).toEqual({
        kind: 'I16',
        value: '-32768',
      });
      expect(
        (yield* decodeSbor(i32)({
          kind: 'I32',
          value: '-2147483648',
        })).toFixed(0),
      ).toBe('-2147483648');
      expect(yield* encodeSbor(i32)(new BigNumber('-2147483648'))).toEqual({
        kind: 'I32',
        value: '-2147483648',
      });
      expect(
        (yield* decodeSbor(i64)({
          kind: 'I64',
          value: '-9223372036854775808',
        })).toFixed(0),
      ).toBe('-9223372036854775808');
      expect(
        yield* encodeSbor(i64)(new BigNumber('-9223372036854775808')),
      ).toEqual({
        kind: 'I64',
        value: '-9223372036854775808',
      });
      expect(
        (yield* decodeSbor(i128)({
          kind: 'I128',
          value: '-170141183460469231731687303715884105728',
        })).toFixed(0),
      ).toBe('-170141183460469231731687303715884105728');
      expect(
        yield* encodeSbor(i128)(
          new BigNumber('-170141183460469231731687303715884105728'),
        ),
      ).toEqual({
        kind: 'I128',
        value: '-170141183460469231731687303715884105728',
      });
      expect(
        (yield* decodeSbor(decimal)({
          kind: 'Decimal',
          value: '1.5',
        })).toString(),
      ).toBe('1.5');
      expect(yield* encodeSbor(decimal)(new BigNumber('1.5'))).toEqual({
        kind: 'Decimal',
        value: '1.5',
      });
      expect(
        (yield* decodeSbor(preciseDecimal)({
          kind: 'PreciseDecimal',
          value: '1.23456789',
        })).toString(),
      ).toBe('1.23456789');
      expect(
        yield* encodeSbor(preciseDecimal)(new BigNumber('1.23456789')),
      ).toEqual({
        kind: 'PreciseDecimal',
        value: '1.23456789',
      });
    }),
  );

  it.effect('round trips instant and every branded address schema', () =>
    Effect.gen(function* () {
      const date = new Date('2025-03-11T17:08:49.000Z');
      expect(
        (yield* decodeSbor(instant)({
          kind: 'I64',
          type_name: 'Instant',
          value: '1741712929',
        })).toISOString(),
      ).toBe(date.toISOString());
      expect(yield* encodeSbor(instant)(date)).toEqual({
        kind: 'I64',
        type_name: 'Instant',
        value: '1741712929',
      });

      const resource = ResourceAddress.make('resource_rdx1');
      expect(
        yield* decodeSbor(resourceAddress)({
          kind: 'Reference',
          type_name: 'ResourceAddress',
          value: resource,
        }),
      ).toBe(resource);
      expect(yield* encodeSbor(resourceAddress)(resource)).toEqual({
        kind: 'Reference',
        type_name: 'ResourceAddress',
        value: resource,
      });

      const component = ComponentAddress.make('component_rdx1');
      expect(
        yield* decodeSbor(componentAddress)({
          kind: 'Reference',
          type_name: 'ComponentAddress',
          value: component,
        }),
      ).toBe(component);
      expect(yield* encodeSbor(componentAddress)(component)).toEqual({
        kind: 'Reference',
        type_name: 'ComponentAddress',
        value: component,
      });

      const account = AccountAddress.make('account_rdx1');
      expect(
        yield* decodeSbor(accountAddress)({
          kind: 'Reference',
          type_name: 'AccountAddress',
          value: account,
        }),
      ).toBe(account);
      expect(yield* encodeSbor(accountAddress)(account)).toEqual({
        kind: 'Reference',
        type_name: 'AccountAddress',
        value: account,
      });

      const packageValue = PackageAddress.make('package_rdx1');
      expect(
        yield* decodeSbor(packageAddress)({
          kind: 'Reference',
          type_name: 'PackageAddress',
          value: packageValue,
        }),
      ).toBe(packageValue);
      expect(yield* encodeSbor(packageAddress)(packageValue)).toEqual({
        kind: 'Reference',
        type_name: 'PackageAddress',
        value: packageValue,
      });

      const nonFungibleResource =
        NonFungibleResourceAddress.make('resource_nft_rdx1');
      expect(
        yield* decodeSbor(nonFungibleResourceAddress)({
          kind: 'Reference',
          type_name: 'NonFungibleResourceAddress',
          value: nonFungibleResource,
        }),
      ).toBe(nonFungibleResource);
      expect(
        yield* encodeSbor(nonFungibleResourceAddress)(nonFungibleResource),
      ).toEqual({
        kind: 'Reference',
        type_name: 'NonFungibleResourceAddress',
        value: nonFungibleResource,
      });

      const internal = InternalAddress.make('internal_rdx1');
      expect(
        yield* decodeSbor(internalAddress)({
          kind: 'Own',
          type_name: 'InternalAddress',
          value: internal,
        }),
      ).toBe(internal);
      expect(yield* encodeSbor(internalAddress)(internal)).toEqual({
        kind: 'Own',
        type_name: 'InternalAddress',
        value: internal,
      });

      const vault = VaultAddress.make('internal_vault_rdx1');
      expect(
        yield* decodeSbor(vaultAddress)({
          kind: 'Own',
          type_name: 'Vault',
          value: vault,
        }),
      ).toBe(vault);
      expect(yield* encodeSbor(vaultAddress)(vault)).toEqual({
        kind: 'Own',
        type_name: 'Vault',
        value: vault,
      });

      const keyValueStore = KeyValueStoreAddress.make('internal_kv_rdx1');
      expect(
        yield* decodeSbor(keyValueStoreAddress)({
          kind: 'Own',
          type_name: 'KeyValueStore',
          value: keyValueStore,
        }),
      ).toBe(keyValueStore);
      expect(yield* encodeSbor(keyValueStoreAddress)(keyValueStore)).toEqual({
        kind: 'Own',
        type_name: 'KeyValueStore',
        value: keyValueStore,
      });

      const localId = NonFungibleLocalId.make('#1#');
      expect(
        yield* decodeSbor(nonFungibleLocalId)({
          kind: 'NonFungibleLocalId',
          value: localId,
        }),
      ).toBe(localId);
      expect(yield* encodeSbor(nonFungibleLocalId)(localId)).toEqual({
        kind: 'NonFungibleLocalId',
        value: localId,
      });
    }),
  );

  it.effect(
    'decodes and encodes an explicit u32 without inferring from value size',
    () =>
      Effect.gen(function* () {
        const decoded = yield* decodeSbor(u32)({ kind: 'U32', value: '7' });

        expect(decoded).toBeInstanceOf(BigNumber);
        expect(decoded.toString()).toBe('7');
        expect(yield* encodeSbor(u32)(new BigNumber(7))).toEqual({
          kind: 'U32',
          value: '7',
        });
      }),
  );

  it.effect('preserves numeric kind in the generic numeric schema', () =>
    Effect.gen(function* () {
      const decoded = yield* decodeSbor(number)({ kind: 'U64', value: '7' });

      expect(decoded).toMatchObject({ type: 'U64' });
      expect(decoded.value).toBeInstanceOf(BigNumber);
      expect(decoded.value.toString()).toBe('7');
      expect(
        yield* encodeSbor(number)({
          type: 'U64',
          value: new BigNumber(7),
        }),
      ).toEqual({
        kind: 'U64',
        value: '7',
      });
    }),
  );

  it.effect('rejects integer encodes which do not fit the explicit type', () =>
    Effect.gen(function* () {
      const result = yield* encodeFailure(u32, new BigNumber('4294967296'));

      assert.isTrue(Either.isLeft(result));
    }),
  );

  it.effect('covers explicit integer ranges and invalid integer values', () =>
    Effect.gen(function* () {
      expect(
        (yield* decodeSbor(u8)({ kind: 'U8', value: '255' })).toString(),
      ).toBe('255');
      expect(
        (yield* decodeSbor(u16)({ kind: 'U16', value: '65535' })).toString(),
      ).toBe('65535');
      expect(
        (yield* decodeSbor(u64)({
          kind: 'U64',
          value: '18446744073709551615',
        })).toString(),
      ).toBe('18446744073709551615');
      expect(
        (yield* decodeSbor(u128)({
          kind: 'U128',
          value: '340282366920938463463374607431768211455',
        })).toFixed(0),
      ).toBe('340282366920938463463374607431768211455');
      expect(
        (yield* decodeSbor(i8)({ kind: 'I8', value: '-128' })).toString(),
      ).toBe('-128');
      expect(
        (yield* decodeSbor(i16)({ kind: 'I16', value: '-32768' })).toString(),
      ).toBe('-32768');
      expect(
        (yield* decodeSbor(i32)({
          kind: 'I32',
          value: '-2147483648',
        })).toString(),
      ).toBe('-2147483648');
      expect(
        (yield* decodeSbor(i64)({
          kind: 'I64',
          value: '-9223372036854775808',
        })).toString(),
      ).toBe('-9223372036854775808');
      expect(
        (yield* decodeSbor(i128)({
          kind: 'I128',
          value: '-170141183460469231731687303715884105728',
        })).toFixed(0),
      ).toBe('-170141183460469231731687303715884105728');

      assert.isTrue(
        Either.isLeft(yield* decodeFailure(u8, { kind: 'U8', value: '256' })),
      );
      assert.isTrue(
        Either.isLeft(
          yield* decodeFailure(u32, { kind: 'U32', value: 'not-an-int' }),
        ),
      );
      assert.isTrue(
        Either.isLeft(yield* encodeFailure(u32, new BigNumber('1.5'))),
      );
    }),
  );

  it.effect('decodes decimal variants and generic numeric failures', () =>
    Effect.gen(function* () {
      expect(
        (yield* decodeSbor(preciseDecimal)({
          kind: 'PreciseDecimal',
          value: '1.23456789',
        })).toString(),
      ).toBe('1.23456789');
      assert.isTrue(
        Either.isLeft(
          yield* decodeFailure(number, { kind: 'String', value: '1' }),
        ),
      );
      assert.isTrue(
        Either.isLeft(yield* decodeFailure(number, { kind: 'U32', value: 1 })),
      );
    }),
  );

  it.effect('decodes semantic scalar values to shared branded types', () =>
    Effect.gen(function* () {
      const decodedResourceAddress = yield* decodeSbor(resourceAddress)({
        kind: 'Reference',
        type_name: 'ResourceAddress',
        value:
          'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
      });
      const decodedNftId = yield* decodeSbor(nonFungibleLocalId)({
        kind: 'NonFungibleLocalId',
        value: '#1#',
      });
      const decodedVaultAddress = yield* decodeSbor(vaultAddress)({
        kind: 'Own',
        type_name: 'Vault',
        value:
          'internal_vault_rdx1tpf4j3xrdvlmmhdk4232gmy65n2dvhuygzj2ufp7jvlkqkr3k70tdx',
      });

      ResourceAddress.make(decodedResourceAddress);
      NonFungibleLocalId.make(decodedNftId);
      VaultAddress.make(decodedVaultAddress);
      expect(
        yield* encodeSbor(nonFungibleLocalId)(NonFungibleLocalId.make('#1#')),
      ).toEqual({
        kind: 'NonFungibleLocalId',
        value: '#1#',
      });
    }),
  );

  it.effect('rejects semantic scalars with the wrong SBOR type name', () =>
    Effect.gen(function* () {
      assert.isTrue(
        Either.isLeft(
          yield* decodeFailure(resourceAddress, {
            kind: 'Reference',
            type_name: 'ComponentAddress',
            value: 'component_rdx1',
          }),
        ),
      );
      assert.isTrue(
        Either.isLeft(
          yield* decodeFailure(vaultAddress, {
            kind: 'Own',
            type_name: 'KeyValueStore',
            value: 'internal_keyvaluestore_rdx1',
          }),
        ),
      );
    }),
  );

  it.effect('decodes bytes and instants and reports invalid bytes kind', () =>
    Effect.gen(function* () {
      expect(
        yield* decodeSbor(bytes)({
          kind: 'Bytes',
          element_kind: 'U8',
          hex: 'deadbeef',
        }),
      ).toBe('deadbeef');
      assert.isTrue(
        Either.isLeft(
          yield* decodeFailure(bytes, {
            kind: 'Bytes',
            element_kind: 'U16',
            hex: '00',
          }),
        ),
      );
      expect(
        (yield* decodeSbor(instant)({
          kind: 'I64',
          type_name: 'Instant',
          value: '1741712929',
        })).toISOString(),
      ).toBe('2025-03-11T17:08:49.000Z');
    }),
  );

  it.effect('uses struct as an ordinary Effect schema transform', () =>
    Effect.gen(function* () {
      const SwapEvent = struct({
        input_address: resourceAddress,
        input_amount: decimal,
        output_address: resourceAddress,
        output_amount: decimal,
        is_success: bool,
      });
      const encoded: ProgrammaticScryptoSborValue = {
        kind: 'Tuple',
        type_name: 'SwapEvent',
        fields: [
          {
            kind: 'Reference',
            type_name: 'ResourceAddress',
            field_name: 'input_address',
            value:
              'resource_rdx1t5pyvlaas0ljxy0wytm5gvyamyv896m69njqdmm2stukr3xexc2up9',
          },
          {
            kind: 'Decimal',
            field_name: 'input_amount',
            value: '0.003427947474666592',
          },
          {
            kind: 'Reference',
            type_name: 'ResourceAddress',
            field_name: 'output_address',
            value:
              'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
          },
          {
            kind: 'Decimal',
            field_name: 'output_amount',
            value: '522.23800528105807128',
          },
          {
            kind: 'Bool',
            field_name: 'is_success',
            value: true,
          },
        ],
      };

      const decoded = yield* decodeSbor(SwapEvent)(encoded);

      expectTypeOf(decoded).not.toBeAny();
      expectTypeOf(decoded).toEqualTypeOf<{
        readonly input_address: ResourceAddress;
        readonly input_amount: BigNumber;
        readonly output_address: ResourceAddress;
        readonly output_amount: BigNumber;
        readonly is_success: boolean;
      }>();
      expect(decoded.input_amount.toString()).toBe('0.003427947474666592');
      expect(decoded.output_amount.toString()).toBe('522.23800528105807128');
      expect(decoded.is_success).toBe(true);
      expect(yield* encodeSbor(SwapEvent)(decoded)).toEqual({
        kind: 'Tuple',
        fields: [
          {
            kind: 'Reference',
            type_name: 'ResourceAddress',
            field_name: 'input_address',
            value:
              'resource_rdx1t5pyvlaas0ljxy0wytm5gvyamyv896m69njqdmm2stukr3xexc2up9',
          },
          {
            kind: 'Decimal',
            field_name: 'input_amount',
            value: '0.003427947474666592',
          },
          {
            kind: 'Reference',
            type_name: 'ResourceAddress',
            field_name: 'output_address',
            value:
              'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
          },
          {
            kind: 'Decimal',
            field_name: 'output_amount',
            value: '522.23800528105807128',
          },
          {
            kind: 'Bool',
            field_name: 'is_success',
            value: true,
          },
        ],
      });
    }),
  );

  it.effect(
    'composes arrays, tuples, options, and maps as Effect schemas',
    () =>
      Effect.gen(function* () {
        const ResourceIndex = map({ key: resourceAddress, value: u128 });
        const Complex = struct({
          items: array(tuple([string, u64])),
          maybe: option(string),
          index: map({ key: string, value: u32 }),
        });

        expectTypeOf<Schema.Schema.Type<typeof ResourceIndex>>().toEqualTypeOf<
          ReadonlyMap<ResourceAddress, BigNumber>
        >();
        expectTypeOf<
          Schema.Schema.Type<typeof Complex>['index']
        >().toEqualTypeOf<ReadonlyMap<string, BigNumber>>();

        const decoded = yield* decodeSbor(Complex)({
          kind: 'Tuple',
          fields: [
            {
              kind: 'Array',
              field_name: 'items',
              element_kind: 'Tuple',
              elements: [
                {
                  kind: 'Tuple',
                  fields: [
                    { kind: 'String', value: 'one' },
                    { kind: 'U64', value: '1' },
                  ],
                },
              ],
            },
            {
              kind: 'Enum',
              type_name: 'Option',
              field_name: 'maybe',
              variant_id: '1',
              variant_name: 'Some',
              fields: [{ kind: 'String', value: 'present' }],
            },
            {
              kind: 'Map',
              field_name: 'index',
              key_kind: 'String',
              value_kind: 'U32',
              entries: [
                {
                  key: { kind: 'String', value: 'count' },
                  value: { kind: 'U32', value: '3' },
                },
              ],
            },
          ],
        });

        expect(decoded.items[0]?.[0]).toBe('one');
        expect(decoded.items[0]?.[1].toString()).toBe('1');
        expect(decoded.maybe).toEqual({ variant: 'Some', value: 'present' });
        expect(decoded.index.get('count')?.toString()).toBe('3');
        expect(yield* encodeSbor(Complex)(decoded)).toMatchObject({
          kind: 'Tuple',
          fields: [
            { field_name: 'items' },
            { field_name: 'maybe' },
            { field_name: 'index' },
          ],
        });
      }),
  );

  it.effect('handles None and invalid Option values', () =>
    Effect.gen(function* () {
      const MaybeString = option(string);

      expect(
        yield* decodeSbor(MaybeString)({
          kind: 'Enum',
          type_name: 'Option',
          variant_id: '0',
          variant_name: 'None',
          fields: [],
        }),
      ).toEqual({ variant: 'None' });
      assert.isTrue(
        Either.isLeft(
          yield* decodeFailure(MaybeString, {
            kind: 'Enum',
            type_name: 'Option',
            variant_id: '2',
            variant_name: 'Other',
            fields: [],
          }),
        ),
      );
      expect(yield* encodeSbor(MaybeString)({ variant: 'None' })).toEqual({
        kind: 'Enum',
        type_name: 'Option',
        variant_id: '0',
        variant_name: 'None',
        fields: [],
      });
    }),
  );

  it.effect('decodes and encodes enum variants through tuple payloads', () =>
    Effect.gen(function* () {
      const Event = enumeration([
        { variant: 'Named', schema: struct({ name: string }) },
        { variant: 'Empty', schema: tuple([]) },
      ]);

      expect(
        yield* decodeSbor(Event)({
          kind: 'Enum',
          variant_id: '0',
          variant_name: 'Named',
          fields: [{ kind: 'String', field_name: 'name', value: 'Ada' }],
        }),
      ).toEqual({
        variant: 'Named',
        value: {
          kind: 'Tuple',
          fields: [{ kind: 'String', field_name: 'name', value: 'Ada' }],
        },
      });
      expect(
        yield* encodeSbor(Event)({
          variant: 'Named',
          value: {
            kind: 'Tuple',
            fields: [{ kind: 'String', field_name: 'name', value: 'Ada' }],
          },
        }),
      ).toEqual({
        kind: 'Enum',
        variant_id: '0',
        variant_name: 'Named',
        fields: [{ kind: 'String', field_name: 'name', value: 'Ada' }],
      });
      assert.isTrue(
        Either.isLeft(
          yield* decodeFailure(Event, {
            kind: 'Enum',
            variant_id: '9',
            variant_name: 'Missing',
            fields: [],
          }),
        ),
      );
    }),
  );

  it.effect(
    'exports an s namespace as aliases to the native named exports',
    () =>
      Effect.sync(() => {
        expect(s.struct).toBe(struct);
        expect(s.resourceAddress).toBe(resourceAddress);
        expect(s.u32).toBe(u32);
      }),
  );
});
