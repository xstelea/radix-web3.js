# Domain Docs

This repo uses a multi-context domain documentation layout.

## Before exploring, read these

- `CONTEXT-MAP.md` at the repo root.
- The relevant package-level `CONTEXT.md`, such as `packages/cli/CONTEXT.md`.
- Root `docs/adr/` for system-wide decisions if it exists.
- Package-level `docs/adr/` directories for context-specific decisions if they exist.

If any of these files don't exist, proceed silently. Don't flag their absence or suggest creating them upfront.

## Current contexts

- `packages/cli/CONTEXT.md` — Radix Web3.js CLI / Agent-first CLI Wallet domain language.

## Use the glossary's vocabulary

When output names a domain concept in an issue title, refactor proposal, hypothesis, test name, PRD, or design doc, use the term as defined in the relevant `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, either reconsider whether you're inventing language the project doesn't use or note the gap for a future domain-modeling pass.

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly rather than silently overriding.
