# radix-connect

## 0.3.3

### Patch Changes

- b1e5ccb: Improve Effect error handling and add functional coverage across package modules.

  - Reject non-finite shared `BigNumberSchema` values and prefer securified account decoding when access-controller data is present.
  - Keep signed partial transaction inspection failures in the typed Effect error channel.
  - Simplify transaction status polling behind a narrow Gateway status interface with deterministic retry tests.

## 0.3.2

### Patch Changes

- c76f14b: Release the pnpm 11, audit remediation, and CI updates across all publishable packages.

## 0.3.1

### Patch Changes

- 6ad81bc: Add package homepage and repository metadata.

## 0.3.0

### Minor Changes

- f241973: add helper to derive private key from bip39 mnemonic

## 0.2.0

### Minor Changes

- 04c1fa7: create ROLA message

## 0.1.3

### Patch Changes

- 97409bc: fetch network error when switching app on ios

## 0.1.2

### Patch Changes

- 45cafce: package update

## 0.1.1

### Patch Changes

- 8d5981f: update files included in package

## 0.1.0

### Minor Changes

- d90334e: add RadixConnectClient and RadixConnectRelayTransport
