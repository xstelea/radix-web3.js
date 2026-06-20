# rdx-cli

## 0.2.4

### Patch Changes

- b1e5ccb: Improve Effect error handling and add functional coverage across package modules.

  - Reject non-finite shared `BigNumberSchema` values and prefer securified account decoding when access-controller data is present.
  - Keep signed partial transaction inspection failures in the typed Effect error channel.
  - Simplify transaction status polling behind a narrow Gateway status interface with deterministic retry tests.

- Updated dependencies [b1e5ccb]
  - @radix-effects/gateway@0.6.4
  - @radix-effects/shared@0.0.5

## 0.2.3

### Patch Changes

- c76f14b: Release the pnpm 11, audit remediation, and CI updates across all publishable packages.
- Updated dependencies [c76f14b]
  - @radix-effects/gateway@0.6.3
  - @radix-effects/shared@0.0.4

## 0.2.2

### Patch Changes

- 6ad81bc: Add package homepage and repository metadata.
- Updated dependencies [6ad81bc]
  - @radix-effects/gateway@0.6.2
  - @radix-effects/shared@0.0.3

## 0.2.1

### Patch Changes

- Updated dependencies [10a80da]
  - @radix-effects/gateway@0.6.1
  - @radix-effects/shared@0.0.2

## 0.2.0

### Minor Changes

- 4627827: Add standalone Subintent signing support for Radix x402 payment flows.

  `rdx-cli` now exposes `rdx subintent prepare` and `rdx subintent build` for creating a root Subintent signing request and building a signed partial transaction from an out-of-band signature.

  `@radix-effects/tx-tool` now exposes signed partial transaction inspection helpers so servers can validate signed Subintent payloads before settling them.

## 0.1.0

### Minor Changes

- 99ebf4b: first release

## 0.1.0

### Minor Changes

- f8a3521: first release
