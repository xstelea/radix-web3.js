# radix-cli

[claw and yoshi](./assets/agent-mascot.png)

Agent-first Radix transaction workflow CLI. The package publishes the `rdx` executable for preparing, inspecting, signing-orchestrating, notarizing, submitting, and tracking Radix Transaction Manifest V2 workflows from files.

`rdx` is not a consumer wallet and does not take key custody. It never stores, accepts, or derives private keys. Participants sign requested `hash.hex` values outside the CLI and return filled signature templates or signature files.

## Installation

```bash
npm install -g radix-cli
```

Or run from a project script after adding `radix-cli` as a dependency.

## Get Started

```bash
rdx llm
rdx --help
rdx config show
```

`rdx llm` prints the embedded Markdown guide for coding agents. Use it as the canonical operational quickstart before automating transaction workflows.

## Safety Model

- Workflow commands are non-interactive and print JSON by default.
- `rdx` defaults to Mainnet; verify the resolved network with `rdx config show` before `tx prepare`.
- Prepared transaction artifacts are network-bound. Do not prepare on one network and submit on another.
- v1 workflow files support Ed25519 keys and signatures only.
- Signing is out of band: sign only the `hash.hex` in generated signing requests.

## Transaction Lifecycle

```bash
rdx config show
rdx tx prepare --manifest ./tx/root.rtm --notary-file ./tx/notary.json
rdx tx add-signatures txid_example --file ./tx/signatures/intent-signature.json
rdx tx notarize txid_example
rdx tx add-signatures txid_example --file ./tx/signatures/notary-signature.json
rdx tx submit txid_example
rdx tx status txid_example
```

For direct child subintents, provide a subintents workflow file during preparation:

```bash
rdx tx prepare --manifest ./tx/root.rtm --subintents ./tx/subintents.json --notary-file ./tx/notary.json
```

Use command JSON output for exact artifact paths. Common artifacts include `prepared.json`, `transactionIntent.json`, `staticAnalysis.json`, `signatures.json`, copied manifests, `notarizedTransaction.hex`, and `submitResult.json`.

## Discovery Commands

```bash
rdx template print subintents
rdx template print signing-request
rdx template print signature-template
rdx template print signature-file
rdx tx path txid_example
rdx tx list
rdx tx list --pattern root.rtm
```

Use `rdx template print ...` for live workflow file shapes. This README intentionally avoids duplicating config or workflow schemas to reduce drift.

## Account Reads

```bash
rdx account show account_rdx1...
rdx account balance account_rdx1...
rdx account derive --public-key 1111111111111111111111111111111111111111111111111111111111111111
rdx tx history account_rdx1... --limit 10
rdx tx status txid_example
```

Account read commands query Gateway state and do not require signing.
`account derive` is offline: it derives the virtual account address for the resolved network and does not prove the account exists on-ledger.

## Current Scope

- Transaction Manifest V2 workflows only.
- Root transaction plus direct child subintents only.
- Ed25519 CLI key/signature workflow files only.
- Out-of-band signing only; no private-key CLI flags or keystore.
- No consumer wallet UX, browser wallet pairing, hardware wallet integration, or high-level transfer builders.

## License

MIT
