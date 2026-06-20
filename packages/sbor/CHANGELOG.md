# @radix-effects/sbor

## 0.3.3

### Patch Changes

- b1e5ccb: Improve Effect error handling and add functional coverage across package modules.

  - Reject non-finite shared `BigNumberSchema` values and prefer securified account decoding when access-controller data is present.
  - Keep signed partial transaction inspection failures in the typed Effect error channel.
  - Simplify transaction status polling behind a narrow Gateway status interface with deterministic retry tests.

- Updated dependencies [b1e5ccb]
  - @radix-effects/shared@0.0.5

## 0.3.2

### Patch Changes

- c76f14b: Release the pnpm 11, audit remediation, and CI updates across all publishable packages.
- Updated dependencies [c76f14b]
  - @radix-effects/shared@0.0.4

## 0.3.1

### Patch Changes

- 6ad81bc: Add package homepage and repository metadata.
- Updated dependencies [6ad81bc]
  - @radix-effects/shared@0.0.3

## 0.3.0

### Minor Changes

- 10a80da: Rename `sbor-ez-mode` to `@radix-effects/sbor` and ship the Effect Schema-native SBOR API.

  The new SBOR package exposes ordinary Effect schemas for decoding and encoding Gateway programmatic SBOR values, including explicit integer schemas, decimal schemas, branded Radix address/local-id schemas, structs, tuples, arrays, maps, options, and enums. Numeric values decode to `BigNumber`, generic numeric decoding preserves the concrete Scrypto kind, and map schemas preserve concrete key/value types.

  Gateway component-state decoding now accepts ordinary Effect schemas via `Schema.decodeUnknown`, and shared Radix branded types have been extended for SBOR semantic values.

### Patch Changes

- Updated dependencies [10a80da]
  - @radix-effects/shared@0.0.2

## 0.2.0

### Minor Changes

- d44818e: add dapp effects

## 0.1.0

### Minor Changes

- b674d38: effects package added
