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
import { BigNumber } from 'bignumber.js';
import { Effect, Either, Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  array,
  bool,
  bytes,
  componentAddress,
  decimal,
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
  nonFungibleResourceAddress,
  nonFungibleLocalId,
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
  accountAddress,
} from './index';

const decode = <S extends Schema.Schema.AnyNoContext>(
  schema: S,
  input: unknown,
) =>
  Effect.runSync(Schema.decodeUnknown(schema)(input));

const encode = <S extends Schema.Schema.AnyNoContext>(
  schema: S,
  input: Schema.Schema.Type<S>,
) =>
  Effect.runSync(Schema.encode(schema)(input));

const decodeFailure = <S extends Schema.Schema.AnyNoContext>(
  schema: S,
  input: unknown,
) => Effect.runSync(Effect.either(Schema.decodeUnknown(schema)(input)));

const encodeFailure = <S extends Schema.Schema.AnyNoContext>(
  schema: S,
  input: Schema.Schema.Type<S>,
) => Effect.runSync(Effect.either(Schema.encode(schema)(input)));

describe('native SBOR Effect schemas', () => {
  it('round trips primitive scalar schemas', () => {
    const raw = { kind: 'String', value: 'raw' };
    expect(decode(value, raw)).toEqual(raw);
    expect(encode(value, raw)).toEqual(raw);

    expect(decode(string, { kind: 'String', value: 'hello' })).toBe('hello');
    expect(encode(string, 'hello')).toEqual({
      kind: 'String',
      value: 'hello',
    });

    expect(decode(bool, { kind: 'Bool', value: true })).toBe(true);
    expect(encode(bool, true)).toEqual({ kind: 'Bool', value: true });

    expect(
      decode(bytes, { kind: 'Bytes', element_kind: 'U8', hex: 'deadbeef' }),
    ).toBe('deadbeef');
    expect(encode(bytes, 'deadbeef')).toEqual({
      kind: 'Bytes',
      element_kind: 'U8',
      element_type_name: 'U8',
      hex: 'deadbeef',
    });
  });

  it('round trips every explicit numeric schema', () => {
    expect(decode(u8, { kind: 'U8', value: '255' }).toFixed(0)).toBe('255');
    expect(encode(u8, new BigNumber(255))).toEqual({
      kind: 'U8',
      value: '255',
    });

    expect(decode(u16, { kind: 'U16', value: '65535' }).toFixed(0)).toBe(
      '65535',
    );
    expect(encode(u16, new BigNumber(65535))).toEqual({
      kind: 'U16',
      value: '65535',
    });

    expect(decode(u32, { kind: 'U32', value: '4294967295' }).toFixed(0)).toBe(
      '4294967295',
    );
    expect(encode(u32, new BigNumber('4294967295'))).toEqual({
      kind: 'U32',
      value: '4294967295',
    });

    expect(
      decode(u64, {
        kind: 'U64',
        value: '18446744073709551615',
      }).toFixed(0),
    ).toBe('18446744073709551615');
    expect(encode(u64, new BigNumber('18446744073709551615'))).toEqual({
      kind: 'U64',
      value: '18446744073709551615',
    });

    expect(
      decode(u128, {
        kind: 'U128',
        value: '340282366920938463463374607431768211455',
      }).toFixed(0),
    ).toBe('340282366920938463463374607431768211455');
    expect(
      encode(u128, new BigNumber('340282366920938463463374607431768211455')),
    ).toEqual({
      kind: 'U128',
      value: '340282366920938463463374607431768211455',
    });

    expect(decode(i8, { kind: 'I8', value: '-128' }).toFixed(0)).toBe('-128');
    expect(encode(i8, new BigNumber(-128))).toEqual({
      kind: 'I8',
      value: '-128',
    });

    expect(decode(i16, { kind: 'I16', value: '-32768' }).toFixed(0)).toBe(
      '-32768',
    );
    expect(encode(i16, new BigNumber(-32768))).toEqual({
      kind: 'I16',
      value: '-32768',
    });

    expect(decode(i32, { kind: 'I32', value: '-2147483648' }).toFixed(0)).toBe(
      '-2147483648',
    );
    expect(encode(i32, new BigNumber('-2147483648'))).toEqual({
      kind: 'I32',
      value: '-2147483648',
    });

    expect(
      decode(i64, {
        kind: 'I64',
        value: '-9223372036854775808',
      }).toFixed(0),
    ).toBe('-9223372036854775808');
    expect(encode(i64, new BigNumber('-9223372036854775808'))).toEqual({
      kind: 'I64',
      value: '-9223372036854775808',
    });

    expect(
      decode(i128, {
        kind: 'I128',
        value: '-170141183460469231731687303715884105728',
      }).toFixed(0),
    ).toBe('-170141183460469231731687303715884105728');
    expect(
      encode(i128, new BigNumber('-170141183460469231731687303715884105728')),
    ).toEqual({
      kind: 'I128',
      value: '-170141183460469231731687303715884105728',
    });

    expect(decode(decimal, { kind: 'Decimal', value: '1.5' }).toString()).toBe(
      '1.5',
    );
    expect(encode(decimal, new BigNumber('1.5'))).toEqual({
      kind: 'Decimal',
      value: '1.5',
    });

    expect(
      decode(preciseDecimal, {
        kind: 'PreciseDecimal',
        value: '1.23456789',
      }).toString(),
    ).toBe('1.23456789');
    expect(encode(preciseDecimal, new BigNumber('1.23456789'))).toEqual({
      kind: 'PreciseDecimal',
      value: '1.23456789',
    });
  });

  it('round trips instant and every branded address schema', () => {
    const date = new Date('2025-03-11T17:08:49.000Z');
    expect(
      decode(instant, {
        kind: 'I64',
        type_name: 'Instant',
        value: '1741712929',
      }).toISOString(),
    ).toBe(date.toISOString());
    expect(encode(instant, date)).toEqual({
      kind: 'I64',
      type_name: 'Instant',
      value: '1741712929',
    });

    const resource = ResourceAddress.make('resource_rdx1');
    expect(
      decode(resourceAddress, {
        kind: 'Reference',
        type_name: 'ResourceAddress',
        value: resource,
      }),
    ).toBe(resource);
    expect(encode(resourceAddress, resource)).toEqual({
      kind: 'Reference',
      type_name: 'ResourceAddress',
      value: resource,
    });

    const component = ComponentAddress.make('component_rdx1');
    expect(
      decode(componentAddress, {
        kind: 'Reference',
        type_name: 'ComponentAddress',
        value: component,
      }),
    ).toBe(component);
    expect(encode(componentAddress, component)).toEqual({
      kind: 'Reference',
      type_name: 'ComponentAddress',
      value: component,
    });

    const account = AccountAddress.make('account_rdx1');
    expect(
      decode(accountAddress, {
        kind: 'Reference',
        type_name: 'AccountAddress',
        value: account,
      }),
    ).toBe(account);
    expect(encode(accountAddress, account)).toEqual({
      kind: 'Reference',
      type_name: 'AccountAddress',
      value: account,
    });

    const packageValue = PackageAddress.make('package_rdx1');
    expect(
      decode(packageAddress, {
        kind: 'Reference',
        type_name: 'PackageAddress',
        value: packageValue,
      }),
    ).toBe(packageValue);
    expect(encode(packageAddress, packageValue)).toEqual({
      kind: 'Reference',
      type_name: 'PackageAddress',
      value: packageValue,
    });

    const nonFungibleResource =
      NonFungibleResourceAddress.make('resource_nft_rdx1');
    expect(
      decode(nonFungibleResourceAddress, {
        kind: 'Reference',
        type_name: 'NonFungibleResourceAddress',
        value: nonFungibleResource,
      }),
    ).toBe(nonFungibleResource);
    expect(
      encode(nonFungibleResourceAddress, nonFungibleResource),
    ).toEqual({
      kind: 'Reference',
      type_name: 'NonFungibleResourceAddress',
      value: nonFungibleResource,
    });

    const internal = InternalAddress.make('internal_rdx1');
    expect(
      decode(internalAddress, {
        kind: 'Own',
        type_name: 'InternalAddress',
        value: internal,
      }),
    ).toBe(internal);
    expect(encode(internalAddress, internal)).toEqual({
      kind: 'Own',
      type_name: 'InternalAddress',
      value: internal,
    });

    const vault = VaultAddress.make('internal_vault_rdx1');
    expect(
      decode(vaultAddress, {
        kind: 'Own',
        type_name: 'Vault',
        value: vault,
      }),
    ).toBe(vault);
    expect(encode(vaultAddress, vault)).toEqual({
      kind: 'Own',
      type_name: 'Vault',
      value: vault,
    });

    const keyValueStore = KeyValueStoreAddress.make('internal_kv_rdx1');
    expect(
      decode(keyValueStoreAddress, {
        kind: 'Own',
        type_name: 'KeyValueStore',
        value: keyValueStore,
      }),
    ).toBe(keyValueStore);
    expect(encode(keyValueStoreAddress, keyValueStore)).toEqual({
      kind: 'Own',
      type_name: 'KeyValueStore',
      value: keyValueStore,
    });

    const localId = NonFungibleLocalId.make('#1#');
    expect(
      decode(nonFungibleLocalId, {
        kind: 'NonFungibleLocalId',
        value: localId,
      }),
    ).toBe(localId);
    expect(encode(nonFungibleLocalId, localId)).toEqual({
      kind: 'NonFungibleLocalId',
      value: localId,
    });
  });

  it('decodes and encodes an explicit u32 without inferring from value size', () => {
    const decoded = decode(u32, { kind: 'U32', value: '7' });

    expect(decoded).toBeInstanceOf(BigNumber);
    expect(decoded.toString()).toBe('7');
    expect(encode(u32, new BigNumber(7))).toEqual({
      kind: 'U32',
      value: '7',
    });
  });

  it('preserves numeric kind in the generic numeric schema', () => {
    const decoded = decode(number, { kind: 'U64', value: '7' });

    expect(decoded).toMatchObject({ type: 'U64' });
    expect(decoded.value).toBeInstanceOf(BigNumber);
    expect(decoded.value.toString()).toBe('7');

    expect(encode(number, { type: 'U64', value: new BigNumber(7) })).toEqual({
      kind: 'U64',
      value: '7',
    });
  });

  it('rejects integer encodes which do not fit the explicit Scrypto type', () => {
    const result = encodeFailure(u32, new BigNumber('4294967296'));

    expect(Either.isLeft(result)).toBe(true);
  });

  it('covers explicit integer ranges and invalid integer values', () => {
    expect(decode(u8, { kind: 'U8', value: '255' }).toString()).toBe('255');
    expect(decode(u16, { kind: 'U16', value: '65535' }).toString()).toBe(
      '65535',
    );
    expect(decode(u64, { kind: 'U64', value: '18446744073709551615' }).toString()).toBe(
      '18446744073709551615',
    );
    expect(decode(u128, { kind: 'U128', value: '340282366920938463463374607431768211455' }).toFixed(0)).toBe(
      '340282366920938463463374607431768211455',
    );
    expect(decode(i8, { kind: 'I8', value: '-128' }).toString()).toBe('-128');
    expect(decode(i16, { kind: 'I16', value: '-32768' }).toString()).toBe(
      '-32768',
    );
    expect(decode(i32, { kind: 'I32', value: '-2147483648' }).toString()).toBe(
      '-2147483648',
    );
    expect(decode(i64, { kind: 'I64', value: '-9223372036854775808' }).toString()).toBe(
      '-9223372036854775808',
    );
    expect(decode(i128, { kind: 'I128', value: '-170141183460469231731687303715884105728' }).toFixed(0)).toBe(
      '-170141183460469231731687303715884105728',
    );

    expect(Either.isLeft(decodeFailure(u8, { kind: 'U8', value: '256' }))).toBe(
      true,
    );
    expect(
      Either.isLeft(decodeFailure(u32, { kind: 'U32', value: 'not-an-int' })),
    ).toBe(true);
    expect(Either.isLeft(encodeFailure(u32, new BigNumber('1.5')))).toBe(true);
  });

  it('decodes decimal variants and generic numeric failures', () => {
    expect(decode(preciseDecimal, {
      kind: 'PreciseDecimal',
      value: '1.23456789',
    }).toString()).toBe('1.23456789');
    expect(Either.isLeft(decodeFailure(number, { kind: 'String', value: '1' }))).toBe(
      true,
    );
    expect(Either.isLeft(decodeFailure(number, { kind: 'U32', value: 1 }))).toBe(
      true,
    );
  });

  it('decodes semantic scalar values to shared branded types', () => {
    const decodedResourceAddress = decode(resourceAddress, {
      kind: 'Reference',
      type_name: 'ResourceAddress',
      value: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
    });
    const decodedNftId = decode(nonFungibleLocalId, {
      kind: 'NonFungibleLocalId',
      value: '#1#',
    });
    const decodedVaultAddress = decode(vaultAddress, {
      kind: 'Own',
      type_name: 'Vault',
      value:
        'internal_vault_rdx1tpf4j3xrdvlmmhdk4232gmy65n2dvhuygzj2ufp7jvlkqkr3k70tdx',
    });

    ResourceAddress.make(decodedResourceAddress);
    NonFungibleLocalId.make(decodedNftId);
    VaultAddress.make(decodedVaultAddress);

    expect(encode(nonFungibleLocalId, NonFungibleLocalId.make('#1#'))).toEqual({
      kind: 'NonFungibleLocalId',
      value: '#1#',
    });
  });

  it('rejects semantic scalars with the wrong SBOR type name', () => {
    expect(
      Either.isLeft(
        decodeFailure(resourceAddress, {
          kind: 'Reference',
          type_name: 'ComponentAddress',
          value: 'component_rdx1',
        }),
      ),
    ).toBe(true);
    expect(
      Either.isLeft(
        decodeFailure(vaultAddress, {
          kind: 'Own',
          type_name: 'KeyValueStore',
          value: 'internal_keyvaluestore_rdx1',
        }),
      ),
    ).toBe(true);
  });

  it('decodes bytes and instants and reports invalid bytes element kind', () => {
    expect(
      decode(bytes, { kind: 'Bytes', element_kind: 'U8', hex: 'deadbeef' }),
    ).toBe('deadbeef');
    expect(
      Either.isLeft(
        decodeFailure(bytes, { kind: 'Bytes', element_kind: 'U16', hex: '00' }),
      ),
    ).toBe(true);
    expect(
      decode(instant, {
        kind: 'I64',
        type_name: 'Instant',
        value: '1741712929',
      }).toISOString(),
    ).toBe('2025-03-11T17:08:49.000Z');
  });

  it('uses struct as an ordinary Effect schema transform', () => {
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

    const decoded = decode(SwapEvent, encoded);

    expect(decoded.input_amount.toString()).toBe('0.003427947474666592');
    expect(decoded.output_amount.toString()).toBe('522.23800528105807128');
    expect(decoded.is_success).toBe(true);
    expect(encode(SwapEvent, decoded)).toEqual({
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
  });

  it('composes arrays, tuples, options, and maps as Effect schemas', () => {
    const Complex = struct({
      items: array(tuple([string, u64])),
      maybe: option(string),
      index: map({ key: string, value: u32 }),
    });

    const decoded = decode(Complex, {
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

    expect(encode(Complex, decoded)).toMatchObject({
      kind: 'Tuple',
      fields: [
        { field_name: 'items' },
        { field_name: 'maybe' },
        { field_name: 'index' },
      ],
    });
  });

  it('handles None and invalid Option values', () => {
    const MaybeString = option(string);

    expect(
      decode(MaybeString, {
        kind: 'Enum',
        type_name: 'Option',
        variant_id: '0',
        variant_name: 'None',
        fields: [],
      }),
    ).toEqual({ variant: 'None' });
    expect(
      Either.isLeft(
        decodeFailure(MaybeString, {
          kind: 'Enum',
          type_name: 'Option',
          variant_id: '2',
          variant_name: 'Other',
          fields: [],
        }),
      ),
    ).toBe(true);
    expect(encode(MaybeString, { variant: 'None' })).toEqual({
      kind: 'Enum',
      type_name: 'Option',
      variant_id: '0',
      variant_name: 'None',
      fields: [],
    });
  });

  it('decodes and encodes enum variants through tuple payloads', () => {
    const Event = enumeration([
      { variant: 'Named', schema: struct({ name: string }) },
      { variant: 'Empty', schema: tuple([]) },
    ]);

    expect(
      decode(Event, {
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
    expect(encode(Event, {
      variant: 'Named',
      value: {
        kind: 'Tuple',
        fields: [{ kind: 'String', field_name: 'name', value: 'Ada' }],
      },
    })).toEqual({
      kind: 'Enum',
      variant_id: '0',
      variant_name: 'Named',
      fields: [{ kind: 'String', field_name: 'name', value: 'Ada' }],
    });
    expect(Either.isLeft(decodeFailure(Event, {
      kind: 'Enum',
      variant_id: '9',
      variant_name: 'Missing',
      fields: [],
    }))).toBe(true);
  });

  it('exports an s namespace as aliases to the native named exports', () => {
    expect(s.struct).toBe(struct);
    expect(s.resourceAddress).toBe(resourceAddress);
    expect(s.u32).toBe(u32);
  });
});
