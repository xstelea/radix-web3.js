# Context Map

This repo uses multiple domain contexts. Read the relevant `CONTEXT.md` before proposing architecture, writing issues, diagnosing bugs, or naming product/design concepts.

## Contexts

| Area | Context file | Use when |
| ---- | ------------ | -------- |
| CLI / Agent-first CLI Wallet | `packages/cli/CONTEXT.md` | Working on `rdx`, transaction workflow artifacts, out-of-band signing, CLI file schemas, structured command output, or agent-first Radix transaction flows. |

## ADRs

- System-wide decisions: `docs/adr/` if present.
- Context-specific decisions: package-level `docs/adr/` directories if present.

Proceed silently when an ADR directory does not exist.
