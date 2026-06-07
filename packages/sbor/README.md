# @radix-effects/sbor

Effect Schema helpers for decoding and encoding Radix Gateway programmatic SBOR values.

The package gives agents and applications a typed language for turning raw Gateway SBOR JSON into JavaScript values with Radix meaning, then encoding those values back into canonical programmatic SBOR.

## Installation

```bash
npm install @radix-effects/sbor
```

`effect` and `bignumber.js` are package dependencies. Add `effect` to your application dependencies too if your application imports from `effect` directly.

## Usage

```typescript
import { Effect } from 'effect';
import { decode, encode, s } from '@radix-effects/sbor';

const SwapEvent = s.struct({
  input_address: s.resourceAddress,
  input_amount: s.decimal,
  output_address: s.resourceAddress,
  output_amount: s.decimal,
  is_success: s.bool,
});

const raw = {
  kind: 'Tuple',
  type_name: 'SwapEvent',
  fields: [
    {
      kind: 'Reference',
      type_name: 'ResourceAddress',
      field_name: 'input_address',
      value: 'resource_rdx1...',
    },
    {
      kind: 'Decimal',
      field_name: 'input_amount',
      value: '10.5',
    },
    {
      kind: 'Reference',
      type_name: 'ResourceAddress',
      field_name: 'output_address',
      value: 'resource_rdx1...',
    },
    {
      kind: 'Decimal',
      field_name: 'output_amount',
      value: '20.25',
    },
    {
      kind: 'Bool',
      field_name: 'is_success',
      value: true,
    },
  ],
};

const program = Effect.gen(function* () {
  const decoded = yield* decode(SwapEvent)(raw);

  decoded.input_amount.toString(); // "10.5"
  decoded.is_success; // boolean

  return yield* encode(SwapEvent)(decoded);
});
```

## Why Effect?

The first version of this package used `neverthrow` for fallible decoding and a small Zod-like schema layer for describing SBOR shapes. That worked for local parsing, but SBOR needs one contract to describe both directions:

- decode raw Gateway programmatic SBOR into domain-friendly JavaScript values
- encode those decoded values back into canonical programmatic SBOR
- keep precise input, output, and error types through nested structs, tuples, maps, options, and enums

Effect Schema fits that model directly. A schema is not only a validator; it is a typed boundary between an encoded representation and a decoded representation. The exported SBOR schemas use that boundary to preserve Radix meaning while still composing with the rest of the Effect ecosystem.

The public `decode` and `encode` helpers return `Effect` values, so callers can run them directly, compose them with Gateway requests, or convert failures at the application edge.

## Schema Helpers

Primitive schemas are exported as values:

```typescript
import { decimal, resourceAddress, struct, u32 } from '@radix-effects/sbor';

const ResourceAmount = struct({
  resource: resourceAddress,
  amount: decimal,
  nonce: u32,
});
```

The default export is the same `s` namespace:

```typescript
import s from '@radix-effects/sbor';

const AccountState = s.struct({
  account: s.accountAddress,
  balance: s.decimal,
});
```

## Numeric Values

Explicit numeric schemas such as `u32`, `u128`, `i64`, `decimal`, and `preciseDecimal` decode to `BigNumber`. The concrete Scrypto numeric kind is carried by the schema.

For values where the concrete numeric kind is not known ahead of time, use `number` / `numeric`; decoded values preserve both the kind and the `BigNumber` value.

## Round Trips

`@radix-effects/sbor` promises semantic round trips, not byte-for-byte or object-shape preservation.

`encode(decode(raw))` may regenerate envelope metadata such as field names, type names, or collection element kinds from the schema. Keep the original raw programmatic SBOR value separately if exact envelope preservation matters.

## License

MIT
