import type { ProgrammaticScryptoSborValue } from '@radixdlt/babylon-gateway-api-sdk';
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
import { assert, describe, expect, expectTypeOf, it } from '@effect/vitest';
import { BigNumber } from 'bignumber.js';
import { Effect, Either, Schema } from 'effect';
import {
  accountAddress,
  array,
  bool,
  bytes,
  componentAddress,
  decode as decodeSbor,
  decimal,
  encode as encodeSbor,
  enumeration,
  i128,
  i16,
  i32,
  i64,
  i8,
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
  u128,
  u16,
  u32,
  u64,
  u8,
  value,
  vaultAddress,
} from './index';

const decode = <S extends Schema.Schema.AnyNoContext>(
  schema: S,
  input: unknown,
) => Schema.decodeUnknown(schema)(input);

const encode = <S extends Schema.Schema.AnyNoContext>(
  schema: S,
  input: Schema.Schema.Type<S>,
) => Schema.encode(schema)(input);

const decodeFailure = <S extends Schema.Schema.AnyNoContext>(
  schema: S,
  input: unknown,
) => Effect.either(decode(schema, input));

const encodeFailure = <S extends Schema.Schema.AnyNoContext>(
  schema: S,
  input: Schema.Schema.Type<S>,
) => Effect.either(encode(schema, input));

describe('native SBOR Effect schemas', () => {
  it.effect('exposes curried decode and encode helpers for migration adapters', () =>
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
    }));

  it.effect('round trips primitive scalar schemas', () =>
    Effect.gen(function* () {
      const raw = { kind: 'String', value: 'raw' };

      expect(yield* decode(value, raw)).toEqual(raw);
      expect(yield* encode(value, raw)).toEqual(raw);
      expect(yield* decode(string, { kind: 'String', value: 'hello' })).toBe(
        'hello',
      );
      expect(yield* encode(string, 'hello')).toEqual({
        kind: 'String',
        value: 'hello',
      });
      expect(yield* decode(bool, { kind: 'Bool', value: true })).toBe(true);
      expect(yield* encode(bool, true)).toEqual({ kind: 'Bool', value: true });
      expect(
        yield* decode(bytes, {
          kind: 'Bytes',
          element_kind: 'U8',
          hex: 'deadbeef',
        }),
      ).toBe('deadbeef');
      expect(yield* encode(bytes, 'deadbeef')).toEqual({
        kind: 'Bytes',
        element_kind: 'U8',
        element_type_name: 'U8',
        hex: 'deadbeef',
      });
    }));

  it.effect('round trips every explicit numeric schema', () =>
    Effect.gen(function* () {
      expect((yield* decode(u8, { kind: 'U8', value: '255' })).toFixed(0)).toBe(
        '255',
      );
      expect(yield* encode(u8, new BigNumber(255))).toEqual({
        kind: 'U8',
        value: '255',
      });
      expect(
        (yield* decode(u16, { kind: 'U16', value: '65535' })).toFixed(0),
      ).toBe('65535');
      expect(yield* encode(u16, new BigNumber(65535))).toEqual({
        kind: 'U16',
        value: '65535',
      });
      expect(
        (yield* decode(u32, { kind: 'U32', value: '4294967295' })).toFixed(0),
      ).toBe('4294967295');
      expect(yield* encode(u32, new BigNumber('4294967295'))).toEqual({
        kind: 'U32',
        value: '4294967295',
      });
      expect(
        (
          yield* decode(u64, {
            kind: 'U64',
            value: '18446744073709551615',
          })
        ).toFixed(0),
      ).toBe('18446744073709551615');
      expect(yield* encode(u64, new BigNumber('18446744073709551615'))).toEqual(
        {
          kind: 'U64',
          value: '18446744073709551615',
        },
      );
      expect(
        (
          yield* decode(u128, {
            kind: 'U128',
            value: '340282366920938463463374607431768211455',
          })
        ).toFixed(0),
      ).toBe('340282366920938463463374607431768211455');
      expect(
        yield* encode(
          u128,
          new BigNumber('340282366920938463463374607431768211455'),
        ),
      ).toEqual({
        kind: 'U128',
        value: '340282366920938463463374607431768211455',
      });
      expect(
        (yield* decode(i8, { kind: 'I8', value: '-128' })).toFixed(0),
      ).toBe('-128');
      expect(yield* encode(i8, new BigNumber(-128))).toEqual({
        kind: 'I8',
        value: '-128',
      });
      expect(
        (yield* decode(i16, { kind: 'I16', value: '-32768' })).toFixed(0),
      ).toBe('-32768');
      expect(yield* encode(i16, new BigNumber(-32768))).toEqual({
        kind: 'I16',
        value: '-32768',
      });
      expect(
        (
          yield* decode(i32, {
            kind: 'I32',
            value: '-2147483648',
          })
        ).toFixed(0),
      ).toBe('-2147483648');
      expect(yield* encode(i32, new BigNumber('-2147483648'))).toEqual({
        kind: 'I32',
        value: '-2147483648',
      });
      expect(
        (
          yield* decode(i64, {
            kind: 'I64',
            value: '-9223372036854775808',
          })
        ).toFixed(0),
      ).toBe('-9223372036854775808');
      expect(yield* encode(i64, new BigNumber('-9223372036854775808'))).toEqual(
        {
          kind: 'I64',
          value: '-9223372036854775808',
        },
      );
      expect(
        (
          yield* decode(i128, {
            kind: 'I128',
            value: '-170141183460469231731687303715884105728',
          })
        ).toFixed(0),
      ).toBe('-170141183460469231731687303715884105728');
      expect(
        yield* encode(
          i128,
          new BigNumber('-170141183460469231731687303715884105728'),
        ),
      ).toEqual({
        kind: 'I128',
        value: '-170141183460469231731687303715884105728',
      });
      expect(
        (yield* decode(decimal, { kind: 'Decimal', value: '1.5' })).toString(),
      ).toBe('1.5');
      expect(yield* encode(decimal, new BigNumber('1.5'))).toEqual({
        kind: 'Decimal',
        value: '1.5',
      });
      expect(
        (
          yield* decode(preciseDecimal, {
            kind: 'PreciseDecimal',
            value: '1.23456789',
          })
        ).toString(),
      ).toBe('1.23456789');
      expect(
        yield* encode(preciseDecimal, new BigNumber('1.23456789')),
      ).toEqual({
        kind: 'PreciseDecimal',
        value: '1.23456789',
      });
    }));

  it.effect('round trips instant and every branded address schema', () =>
    Effect.gen(function* () {
      const date = new Date('2025-03-11T17:08:49.000Z');
      expect(
        (
          yield* decode(instant, {
            kind: 'I64',
            type_name: 'Instant',
            value: '1741712929',
          })
        ).toISOString(),
      ).toBe(date.toISOString());
      expect(yield* encode(instant, date)).toEqual({
        kind: 'I64',
        type_name: 'Instant',
        value: '1741712929',
      });

      const resource = ResourceAddress.make('resource_rdx1');
      expect(
        yield* decode(resourceAddress, {
          kind: 'Reference',
          type_name: 'ResourceAddress',
          value: resource,
        }),
      ).toBe(resource);
      expect(yield* encode(resourceAddress, resource)).toEqual({
        kind: 'Reference',
        type_name: 'ResourceAddress',
        value: resource,
      });

      const component = ComponentAddress.make('component_rdx1');
      expect(
        yield* decode(componentAddress, {
          kind: 'Reference',
          type_name: 'ComponentAddress',
          value: component,
        }),
      ).toBe(component);
      expect(yield* encode(componentAddress, component)).toEqual({
        kind: 'Reference',
        type_name: 'ComponentAddress',
        value: component,
      });

      const account = AccountAddress.make('account_rdx1');
      expect(
        yield* decode(accountAddress, {
          kind: 'Reference',
          type_name: 'AccountAddress',
          value: account,
        }),
      ).toBe(account);
      expect(yield* encode(accountAddress, account)).toEqual({
        kind: 'Reference',
        type_name: 'AccountAddress',
        value: account,
      });

      const packageValue = PackageAddress.make('package_rdx1');
      expect(
        yield* decode(packageAddress, {
          kind: 'Reference',
          type_name: 'PackageAddress',
          value: packageValue,
        }),
      ).toBe(packageValue);
      expect(yield* encode(packageAddress, packageValue)).toEqual({
        kind: 'Reference',
        type_name: 'PackageAddress',
        value: packageValue,
      });

      const nonFungibleResource =
        NonFungibleResourceAddress.make('resource_nft_rdx1');
      expect(
        yield* decode(nonFungibleResourceAddress, {
          kind: 'Reference',
          type_name: 'NonFungibleResourceAddress',
          value: nonFungibleResource,
        }),
      ).toBe(nonFungibleResource);
      expect(
        yield* encode(nonFungibleResourceAddress, nonFungibleResource),
      ).toEqual({
        kind: 'Reference',
        type_name: 'NonFungibleResourceAddress',
        value: nonFungibleResource,
      });

      const internal = InternalAddress.make('internal_rdx1');
      expect(
        yield* decode(internalAddress, {
          kind: 'Own',
          type_name: 'InternalAddress',
          value: internal,
        }),
      ).toBe(internal);
      expect(yield* encode(internalAddress, internal)).toEqual({
        kind: 'Own',
        type_name: 'InternalAddress',
        value: internal,
      });

      const vault = VaultAddress.make('internal_vault_rdx1');
      expect(
        yield* decode(vaultAddress, {
          kind: 'Own',
          type_name: 'Vault',
          value: vault,
        }),
      ).toBe(vault);
      expect(yield* encode(vaultAddress, vault)).toEqual({
        kind: 'Own',
        type_name: 'Vault',
        value: vault,
      });

      const keyValueStore = KeyValueStoreAddress.make('internal_kv_rdx1');
      expect(
        yield* decode(keyValueStoreAddress, {
          kind: 'Own',
          type_name: 'KeyValueStore',
          value: keyValueStore,
        }),
      ).toBe(keyValueStore);
      expect(yield* encode(keyValueStoreAddress, keyValueStore)).toEqual({
        kind: 'Own',
        type_name: 'KeyValueStore',
        value: keyValueStore,
      });

      const localId = NonFungibleLocalId.make('#1#');
      expect(
        yield* decode(nonFungibleLocalId, {
          kind: 'NonFungibleLocalId',
          value: localId,
        }),
      ).toBe(localId);
      expect(yield* encode(nonFungibleLocalId, localId)).toEqual({
        kind: 'NonFungibleLocalId',
        value: localId,
      });
    }));

  it.effect(
    'decodes and encodes an explicit u32 without inferring from value size',
    () =>
      Effect.gen(function* () {
        const decoded = yield* decode(u32, { kind: 'U32', value: '7' });

        expect(decoded).toBeInstanceOf(BigNumber);
        expect(decoded.toString()).toBe('7');
        expect(yield* encode(u32, new BigNumber(7))).toEqual({
          kind: 'U32',
          value: '7',
        });
      }),
  );

  it.effect('preserves numeric kind in the generic numeric schema', () =>
    Effect.gen(function* () {
      const decoded = yield* decode(number, { kind: 'U64', value: '7' });

      expect(decoded).toMatchObject({ type: 'U64' });
      expect(decoded.value).toBeInstanceOf(BigNumber);
      expect(decoded.value.toString()).toBe('7');
      expect(
        yield* encode(number, {
          type: 'U64',
          value: new BigNumber(7),
        }),
      ).toEqual({
        kind: 'U64',
        value: '7',
      });
    }));

  it.effect('rejects integer encodes which do not fit the explicit type', () =>
    Effect.gen(function* () {
      const result = yield* encodeFailure(u32, new BigNumber('4294967296'));

      assert.isTrue(Either.isLeft(result));
    }));

  it.effect('covers explicit integer ranges and invalid integer values', () =>
    Effect.gen(function* () {
      expect((yield* decode(u8, { kind: 'U8', value: '255' })).toString()).toBe(
        '255',
      );
      expect(
        (yield* decode(u16, { kind: 'U16', value: '65535' })).toString(),
      ).toBe('65535');
      expect(
        (
          yield* decode(u64, {
            kind: 'U64',
            value: '18446744073709551615',
          })
        ).toString(),
      ).toBe('18446744073709551615');
      expect(
        (
          yield* decode(u128, {
            kind: 'U128',
            value: '340282366920938463463374607431768211455',
          })
        ).toFixed(0),
      ).toBe('340282366920938463463374607431768211455');
      expect(
        (yield* decode(i8, { kind: 'I8', value: '-128' })).toString(),
      ).toBe('-128');
      expect(
        (yield* decode(i16, { kind: 'I16', value: '-32768' })).toString(),
      ).toBe('-32768');
      expect(
        (
          yield* decode(i32, {
            kind: 'I32',
            value: '-2147483648',
          })
        ).toString(),
      ).toBe('-2147483648');
      expect(
        (
          yield* decode(i64, {
            kind: 'I64',
            value: '-9223372036854775808',
          })
        ).toString(),
      ).toBe('-9223372036854775808');
      expect(
        (
          yield* decode(i128, {
            kind: 'I128',
            value: '-170141183460469231731687303715884105728',
          })
        ).toFixed(0),
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
    }));

  it.effect('decodes decimal variants and generic numeric failures', () =>
    Effect.gen(function* () {
      expect(
        (
          yield* decode(preciseDecimal, {
            kind: 'PreciseDecimal',
            value: '1.23456789',
          })
        ).toString(),
      ).toBe('1.23456789');
      assert.isTrue(
        Either.isLeft(
          yield* decodeFailure(number, { kind: 'String', value: '1' }),
        ),
      );
      assert.isTrue(
        Either.isLeft(yield* decodeFailure(number, { kind: 'U32', value: 1 })),
      );
    }));

  it.effect('decodes semantic scalar values to shared branded types', () =>
    Effect.gen(function* () {
      const decodedResourceAddress = yield* decode(resourceAddress, {
        kind: 'Reference',
        type_name: 'ResourceAddress',
        value:
          'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
      });
      const decodedNftId = yield* decode(nonFungibleLocalId, {
        kind: 'NonFungibleLocalId',
        value: '#1#',
      });
      const decodedVaultAddress = yield* decode(vaultAddress, {
        kind: 'Own',
        type_name: 'Vault',
        value:
          'internal_vault_rdx1tpf4j3xrdvlmmhdk4232gmy65n2dvhuygzj2ufp7jvlkqkr3k70tdx',
      });

      ResourceAddress.make(decodedResourceAddress);
      NonFungibleLocalId.make(decodedNftId);
      VaultAddress.make(decodedVaultAddress);
      expect(
        yield* encode(nonFungibleLocalId, NonFungibleLocalId.make('#1#')),
      ).toEqual({
        kind: 'NonFungibleLocalId',
        value: '#1#',
      });
    }));

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
    }));

  it.effect('decodes bytes and instants and reports invalid bytes kind', () =>
    Effect.gen(function* () {
      expect(
        yield* decode(bytes, {
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
        (
          yield* decode(instant, {
            kind: 'I64',
            type_name: 'Instant',
            value: '1741712929',
          })
        ).toISOString(),
      ).toBe('2025-03-11T17:08:49.000Z');
    }));

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

      const decoded = yield* decode(SwapEvent, encoded);

      expect(decoded.input_amount.toString()).toBe('0.003427947474666592');
      expect(decoded.output_amount.toString()).toBe('522.23800528105807128');
      expect(decoded.is_success).toBe(true);
      expect(yield* encode(SwapEvent, decoded)).toEqual({
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
    }));

  it.effect('composes arrays, tuples, options, and maps as Effect schemas', () =>
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

      const decoded = yield* decode(Complex, {
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
      expect(yield* encode(Complex, decoded)).toMatchObject({
        kind: 'Tuple',
        fields: [
          { field_name: 'items' },
          { field_name: 'maybe' },
          { field_name: 'index' },
        ],
      });
    }));

  it.effect('handles None and invalid Option values', () =>
    Effect.gen(function* () {
      const MaybeString = option(string);

      expect(
        yield* decode(MaybeString, {
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
      expect(yield* encode(MaybeString, { variant: 'None' })).toEqual({
        kind: 'Enum',
        type_name: 'Option',
        variant_id: '0',
        variant_name: 'None',
        fields: [],
      });
    }));

  it.effect('decodes and encodes enum variants through tuple payloads', () =>
    Effect.gen(function* () {
      const Event = enumeration([
        { variant: 'Named', schema: struct({ name: string }) },
        { variant: 'Empty', schema: tuple([]) },
      ]);

      expect(
        yield* decode(Event, {
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
        yield* encode(Event, {
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
    }));

  it.effect('exports an s namespace as aliases to the native named exports', () =>
    Effect.sync(() => {
      expect(s.struct).toBe(struct);
      expect(s.resourceAddress).toBe(resourceAddress);
      expect(s.u32).toBe(u32);
    }));
});
