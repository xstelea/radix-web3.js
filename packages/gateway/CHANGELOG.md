# @radix-effects/gateway

## 0.6.1

### Patch Changes

- 10a80da: Rename `sbor-ez-mode` to `@radix-effects/sbor` and ship the Effect Schema-native SBOR API.

  The new SBOR package exposes ordinary Effect schemas for decoding and encoding Gateway programmatic SBOR values, including explicit integer schemas, decimal schemas, branded Radix address/local-id schemas, structs, tuples, arrays, maps, options, and enums. Numeric values decode to `BigNumber`, generic numeric decoding preserves the concrete Scrypto kind, and map schemas preserve concrete key/value types.

  Gateway component-state decoding now accepts ordinary Effect schemas via `Schema.decodeUnknown`, and shared Radix branded types have been extended for SBOR semantic values.

- Updated dependencies [10a80da]
  - @radix-effects/sbor@0.3.0

## 0.6.0

### Minor Changes

- 37c64d3: subintent support
- e62bfdb: preview tx v2

## 0.6.0-dev.1

### Minor Changes

- e62bfdb: preview tx v2

## 0.6.0-dev.0

### Minor Changes

- 37c64d3: subintent support

## 0.5.0

### Minor Changes

- c6d94a4: make at_ledger_state param optional

## 0.4.2

### Patch Changes

- 332fb38: expose stateEntityDetails

## 0.4.1

### Patch Changes

- ce514e9: update dependencies

## 0.4.0

### Minor Changes

- 0d79781: gateway client layer now required

## 0.3.2

### Patch Changes

- 8a54739: expose networkId

## 0.3.1

### Patch Changes

- 65192ac: add transactionPreview method

## 0.3.0

### Minor Changes

- f236696: Add transaction stream package

## 0.2.1

### Patch Changes

- 13dd472: handle ConfigError as defect

## 0.2.0

### Minor Changes

- fbcd516: add rola verification

## 0.1.0

### Minor Changes

- 607469c: create package
