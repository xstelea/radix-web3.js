---
"@radix-effects/tx-tool": minor
"rdx-cli": minor
---

Add standalone Subintent signing support for Radix x402 payment flows.

`rdx-cli` now exposes `rdx subintent prepare` and `rdx subintent build` for creating a root Subintent signing request and building a signed partial transaction from an out-of-band signature.

`@radix-effects/tx-tool` now exposes signed partial transaction inspection helpers so servers can validate signed Subintent payloads before settling them.
