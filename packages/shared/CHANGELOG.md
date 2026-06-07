# @radix-effects/shared

## 0.0.2

### Patch Changes

- 10a80da: Rename `sbor-ez-mode` to `@radix-effects/sbor` and ship the Effect Schema-native SBOR API.

  The new SBOR package exposes ordinary Effect schemas for decoding and encoding Gateway programmatic SBOR values, including explicit integer schemas, decimal schemas, branded Radix address/local-id schemas, structs, tuples, arrays, maps, options, and enums. Numeric values decode to `BigNumber`, generic numeric decoding preserves the concrete Scrypto kind, and map schemas preserve concrete key/value types.

  Gateway component-state decoding now accepts ordinary Effect schemas via `Schema.decodeUnknown`, and shared Radix branded types have been extended for SBOR semantic values.

## 0.0.1

### Patch Changes

- 6f71e29: deploy package
