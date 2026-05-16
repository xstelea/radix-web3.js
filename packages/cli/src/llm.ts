export const llmGuide = `# rdx Agent Guide

Use \`rdx\` to prepare, inspect, sign-orchestrate, notarize, submit, and track Radix Transaction Manifest V2 workflows from files. It is built for agents: workflow commands are non-interactive and print JSON by default.

## Core Rules

- Run \`rdx config show\` before \`tx prepare\` to verify the resolved network and artifact root.
- After \`tx prepare\`, check \`startEpochInclusive\` and \`endEpochExclusive\` in the command JSON before collecting signatures.
- \`rdx\` defaults to Mainnet. Prepare on the intended network; do not reuse prepared artifacts across networks.
- A transaction lifecycle is network-bound from \`tx prepare\` through signing, notarization, submission, and status.
- \`rdx\` never stores, accepts, or derives private keys.
- Participants sign only the requested \`hash.hex\` outside \`rdx\` and return a filled signature template or signature file.
- v1 CLI workflow files support Ed25519 only. Secp256k1 and other curves are rejected.
- Use \`rdx account derive --public-key <hex>\` to derive a virtual account address offline from an Ed25519 public key.
- Do not edit signing request files. Fill signature templates or create signature files instead.
- Do not rerun \`tx prepare\` expecting overwrite. Existing transaction artifact directories are protected.
- Do not submit until intent, subintent, notary-signatory, and notary signatures required by the artifacts are complete.
- Use \`tx path\` and \`tx list\` before manually scanning artifact directories.

## Discover Live Inputs

\`\`\`sh
rdx config show
rdx template print subintents
rdx template print signing-request
rdx template print signature-template
rdx template print signature-file
rdx --help
rdx tx prepare --help
\`\`\`

Use template output for workflow file shapes. Do not rely on copied config schemas; use \`rdx config show\` for resolved configuration.

## Transaction Lifecycle

1. Prepare: compile the root manifest plus optional direct child subintents, preview, and write immutable transaction artifacts.
2. Inspect: read command JSON output, \`prepared.json\`, copied manifests, signing requests, and templates.
3. Intent signing: each participant signs the relevant request \`hash.hex\` out of band.
4. Import signatures: use \`tx add-signatures\` one or more times. Imports are normalized into \`signatures.json\`.
5. Notarize: after intent/subintent signatures are locally complete, \`tx notarize\` previews the signed intent and creates the notary signing request.
6. Notary signing: the notary signs the notary request \`hash.hex\` out of band.
7. Import notary signature: use \`tx add-signatures\` again.
8. Submit: \`tx submit\` compiles from prepared artifacts plus canonical signatures, writes the submitted payload, broadcasts, polls, and records the result.
9. Track: use \`tx status\`, \`tx path\`, and \`tx list\` to inspect local and Gateway state.

## Stable Artifact Mental Model

Use command JSON outputs for exact paths. Common artifact files include:

- \`prepared.json\`: canonical prepared metadata and signing request/template path index.
- \`transactionIntent.json\`: encoded Transaction Intent V2 used by later commands.
- \`staticAnalysis.json\`: full static analysis output.
- \`rootManifest.rtm\`: copied root manifest.
- \`subintents/<subintentId>.rtm\`: copied direct child subintent manifests.
- \`signatures.json\`: canonical normalized signature state.
- \`notarizedTransaction.hex\`: exact submitted payload.
- \`submitResult.json\`: submit attempts and network status results.

## Single-party Example

\`\`\`sh
rdx config show
rdx template print signature-file
rdx tx prepare --manifest ./tx/root.rtm --notary-file ./tx/notary.json
rdx tx path txid_example
rdx tx add-signatures txid_example --file ./tx/signatures/intent-signature.json
rdx tx notarize txid_example
rdx tx add-signatures txid_example --file ./tx/signatures/notary-signature.json
rdx tx submit txid_example
rdx tx status txid_example
\`\`\`

After \`tx prepare\`, inspect the JSON result for \`transactionId\`, \`artifactPath\`, \`preparedPath\`, \`startEpochInclusive\`, \`endEpochExclusive\`, and generated \`signatureTemplatePaths\`. Fill the generated templates by replacing placeholder Ed25519 public key and signature values. Sign only each request's \`hash.hex\`.

## Multi-party And Subintent Example

\`\`\`sh
rdx config show
rdx template print subintents
rdx tx prepare --manifest ./tx/root.rtm --subintents ./tx/subintents.json --notary-file ./tx/notary.json
rdx tx add-signatures txid_example --file ./party-a/root-signature.json
rdx tx add-signatures txid_example --file ./party-b/child-one-signature.json
rdx tx add-signatures txid_example --file ./party-c/batch-signatures.json
rdx tx notarize txid_example
rdx tx add-signatures txid_example --file ./notary/notary-signature.json
rdx tx submit txid_example
\`\`\`

Subintent IDs in \`subintents.json\` are also Radix \`NamedIntent\` values referenced by root \`YIELD_TO_CHILD\` instructions. v1 supports root plus direct child subintents only. Multiple parties can return signatures asynchronously; repeat \`tx add-signatures\` until local completeness allows \`tx notarize\` and later \`tx submit\`.

## Command Examples

\`\`\`sh
rdx config show
rdx account derive --public-key 1111111111111111111111111111111111111111111111111111111111111111
rdx account show account_rdx1...
rdx account fungibles account_rdx1...
rdx account nfts account_rdx1...
rdx tx history account_rdx1... --limit 10
rdx tx prepare --manifest ./tx/root.rtm --notary-file ./tx/notary.json
rdx tx prepare --manifest ./tx/root.rtm --subintents ./tx/subintents.json --notary-file ./tx/notary.json
rdx tx add-signatures txid_example --file ./signature.json
rdx tx add-signatures txid_example --file ./signature-a.json --file ./signature-batch.json
rdx tx notarize txid_example
rdx tx submit txid_example
rdx tx status txid_example
rdx tx status txid_example --read-only
rdx tx path txid_example
rdx tx list
rdx tx list --pattern root.rtm
rdx tx list --regex '^txid_' --network mainnet --status prepared
rdx tx list --with-network-status
rdx tx list --with-network-status --update-network-status
rdx template print subintents
rdx template print signing-request
rdx template print signature-template
rdx template print signature-file
\`\`\`

\`account derive\` uses the resolved config network and does not query Gateway. It returns the derived virtual account address, not proof that the account exists on-ledger.

## Troubleshooting

- Workflow command failures print structured JSON errors with \`type\`, \`code\`, and \`message\`.
- Gateway failures include response details in \`message\` when the Gateway returns a structured error body.
- Inspect \`code\` and \`message\` first; avoid parsing human help text.
- Use \`rdx tx status\`, \`rdx tx list\`, and \`rdx tx path\` before reading files manually.
- If the network is wrong, prepare a new transaction for the intended network.
- If a placeholder public key or signature remains in a file, replace it with a real Ed25519 value produced outside \`rdx\`.
`;
