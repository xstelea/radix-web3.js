---
"@radix-effects/gateway": patch
"@radix-effects/sbor": patch
"@radix-effects/shared": patch
"@radix-effects/transaction-stream": patch
"@radix-effects/tx-tool": patch
"radix-agent-toolkit": patch
"radix-connect": patch
"radix-web3.js": patch
"rdx-cli": patch
---

Improve Effect error handling and add functional coverage across package modules.

- Reject non-finite shared `BigNumberSchema` values and prefer securified account decoding when access-controller data is present.
- Keep signed partial transaction inspection failures in the typed Effect error channel.
- Simplify transaction status polling behind a narrow Gateway status interface with deterministic retry tests.
