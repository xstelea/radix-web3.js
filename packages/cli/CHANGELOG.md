# rdx-cli

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
