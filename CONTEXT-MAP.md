# Context Map

This repo uses multiple domain contexts. Read the relevant `CONTEXT.md` before proposing architecture, writing issues, diagnosing bugs, or naming product/design concepts.

## Contexts

| Area | Context file | Use when |
| ---- | ------------ | -------- |
| CLI / Agent-first CLI Wallet | `packages/cli/CONTEXT.md` | Working on `rdx`, transaction workflow artifacts, out-of-band signing, CLI file schemas, structured command output, or agent-first Radix transaction flows. |
| SBOR EZ Mode | `packages/sbor-ez-mode/CONTEXT.md` | Working on programmatic SBOR decoding/encoding, schema builders, Scrypto value representations, or Effect Schema integration for SBOR values. |
| x402 Radix Reference Design | `examples/x402/CONTEXT.md` | Working on the x402 reference implementation, sponsored payment flow, Hono resource server or facilitator, and agent client payment examples. |

## ADRs

- System-wide decisions: `docs/adr/` if present.
- Context-specific decisions: package-level `docs/adr/` directories if present.

Proceed silently when an ADR directory does not exist.
