# Radix Web3.js

Radix Web3.js provides TypeScript packages for building Radix applications, agent tooling, and transaction workflows.

## Language

**Agent-first CLI Wallet**:
A local-key command-line signer and transaction executor designed for autonomous agents and scripted workflows.
_Avoid_: Consumer wallet, browser wallet, mobile wallet

**radix-cli**:
The npm package that distributes the Agent-first CLI Wallet executable.
_Avoid_: radix-agent-toolkit, radix-web3.js core

**rdx**:
The command-line binary exposed by the radix-cli package.
_Avoid_: radix-wallet, radix-cli command

**Radix Agent Protocol (RAP)**:
The draft versioned state-machine protocol for coordinating agent-first Radix transaction workflows without taking key custody.
_Avoid_: CLI internals, wallet protocol, generic command schema

**RAP Transaction State Machine**:
The ordered set of transaction phases and typed payloads that move a RAP workflow from draft inputs to prepared, signed, notarized, submitted, and observed states.
_Avoid_: Command sequence, artifact checklist, help text mirror

**Agent-first Interface**:
A command interface that defaults to structured output, stable exit codes, explicit flags, and non-interactive execution.
_Avoid_: Human-first CLI, prompt-driven CLI

**Agent-managed Key**:
An Ed25519 private key whose custody is owned by the calling agent, not by the CLI wallet.
_Avoid_: CLI keystore, managed wallet key

**Out-of-band Signing**:
A signing flow where rdx outputs a transaction hash and the calling agent returns a signature produced outside the CLI.
_Avoid_: In-process private key signing, CLI key custody

**Signing Request**:
A structured JSON handoff from rdx to an agent containing the transaction hash and context needed for out-of-band signing.
_Avoid_: Bare hash, opaque signing blob

**Generic Signing Request**:
A signing request produced before signer public keys are known, scoped to an account authorization requirement or notary role.
_Avoid_: Public-key-required signing request, signer claim prerequisite

**Signature Template**:
A generated JSON response template that mirrors a signing request and contains placeholders for public key and signature values.
_Avoid_: Editing signing request, handwritten signature response

**Signing Scope**:
The part of a transaction workflow a signing request or signature applies to: root intent, a specific subintent, or notary.
_Avoid_: Unscoped signature, filename-only signature target

**Signer Public Key**:
The Ed25519 public key expected to authorize and verify an out-of-band transaction signature.
_Avoid_: Account address as signer identity, signer label, signer alias

**CLI Public Key**:
The explicit public key shape used by rdx workflow files, containing curve and hex fields.
_Avoid_: Bare public key hex in CLI files

**CLI Signature**:
The explicit signature shape used by rdx workflow files, containing curve and hex fields plus the matching CLI public key.
_Avoid_: tx-tool signature encoding in CLI files, bare signature hex

**Signer Set**:
The one or more signer public keys expected to authorize a prepared transaction.
_Avoid_: Single implicit signer, account-derived signer

**Notary Public Key**:
The Ed25519 public key expected to notarize a prepared transaction.
_Avoid_: CLI-owned notary key, implicit notary

**Notary File**:
A JSON file or config entry that supplies the notary public key and signatory setting before transaction preparation.
_Avoid_: Notary claim, inferred notary key, CLI-owned notary key

**Signatory Notary**:
A notary that also counts as an authorizing signer for the transaction intent.
_Avoid_: Non-signatory default notary

**Preview-before-Signing**:
A safety step where rdx simulates the transaction through Gateway before emitting a signing request.
_Avoid_: Blind signing, compile-only signing

**Prepare Preview**:
A Gateway preview run during transaction preparation without requiring signer public keys.
_Avoid_: Public-key-gated prepare, skipped early preview

**Account Read Command**:
A read-only rdx command that queries Gateway for account-scoped state such as balance or transaction history.
_Avoid_: Portfolio indexer, full ledger explorer

**Fungible Token Read Command**:
An Account Read Command that returns Gateway-shaped fungible resource balances for one account.
_Avoid_: Combined balance command, portfolio command, token command

**NFT Read Command**:
An Account Read Command that returns Gateway-shaped non-fungible resources for one account.
_Avoid_: Combined balance command, non-fungible balance command, NFT portfolio indexer

**Account Read Result**:
A Gateway-shaped command result returned by an Account Read Command through rdx, with only JSON-safety normalization such as BigNumber-to-string conversion.
_Avoid_: Hand-normalized CLI DTO, portfolio model

**Virtual Account Address Derivation**:
A read-only rdx operation that derives the Radix virtual account address controlled by an Ed25519 public key on a selected network.
_Avoid_: Generic public key hash command, account lookup, owner key verification

**Default Network**:
Mainnet is the network used by rdx when no network is specified.
_Avoid_: Stokenet by default, implicit testnet

**Network-bound Transaction Workflow**:
A transaction lifecycle whose manifests, previews, transaction ID, artifacts, signatures, notarization, and submission all belong to one selected Radix network.
_Avoid_: Switching networks after preparation, reusing Stokenet artifacts on Mainnet

**Submit Command**:
The rdx command that broadcasts a signed transaction to the selected Radix network.
_Avoid_: Extra mainnet guard, separate risk-acceptance flag

**Prepared Transaction File**:
A JSON file produced by rdx that contains the signing request and compiled transaction context needed for later submission.
_Avoid_: Recompiled submit input, stdout-only signing request, RTM-dependent submit

**Transaction Intent File**:
A separate JSON-encoded Transaction Manifest V2 intent file used as the execution source for later rdx commands.
_Avoid_: Embedded intent inside prepared metadata, reparsing copied RTM files for execution

**Signature File**:
A JSON file supplied to rdx that contains out-of-band signatures for a prepared transaction.
_Avoid_: Signature command flags, inline signature arguments

**Intent Signature File**:
A typed signature file containing signatures over a prepared transaction intent hash.
_Avoid_: Untyped signature list, notary signature file

**Notary Signature File**:
A typed signature file containing the signature over a notary hash.
_Avoid_: Intent signature file, inline notary signature

**Local Signature Verification**:
rdx verification that supplied Ed25519 signatures match expected hashes and public keys before continuing the transaction flow.
_Avoid_: Gateway-only signature failure, unchecked signature file

**Tx Header File**:
A JSON file containing advanced transaction header overrides used during transaction preparation.
_Avoid_: Header override flags, implicit advanced settings

**Signers File**:
A JSON file that declares the intent signer public keys and notary public key for transaction preparation.
_Avoid_: Signer public key flags, notary public key flags

**Template Command**:
An rdx command that writes skeleton JSON files for file-driven workflows.
_Avoid_: Documentation-only schema discovery, handwritten boilerplate

**LLM Instructions Command**:
An rdx command that prints compact Markdown instructions and command examples for coding agents using the CLI.
_Avoid_: JSON workflow result, human-only manual, external-only documentation

**Embedded Agent Guide**:
A static Markdown guide bundled into rdx that explains transaction lifecycle, key custody, out-of-band signing, multi-party signing, and command usage.
_Avoid_: Generated help mirror, external-only README, dynamic command schema dump

**CLI File Schema**:
The JSON shape used by rdx workflow files, using camelCase field names.
_Avoid_: snake_case JSON, kebab-case JSON

**Typed Workflow File**:
An rdx JSON workflow file with mandatory type and version fields.
_Avoid_: Untyped JSON file, implicit schema version

**Command Result**:
A compact JSON object printed to stdout after an rdx command completes.
_Avoid_: Log-only success, artifact-only output

**Structured Error**:
A JSON error printed by rdx with a stable code, message, and optional details.
_Avoid_: Free-form stderr, stack trace as user-facing error

**Output Format**:
The command output mode, defaulting to JSON with optional text formatting for humans.
_Avoid_: Text-first CLI output, implicit pretty output

**Rdx Config File**:
An optional non-secret JSON configuration file for rdx defaults such as network and Gateway URL.
_Avoid_: Secret storage, required project config, rdx.config.json

**Transaction Correlation ID**:
A transaction-id-derived identifier used by rdx to relate prepared transactions, signature files, notary requests, and submit results for one transaction workflow.
_Avoid_: UUID workflow ID, filename-only correlation

**Artifacts Directory**:
A configured directory where rdx writes transaction workflow artifacts.
_Avoid_: Unscoped temporary files, implicit current-directory artifacts

**Artifact Scope**:
The configuration choice that determines whether transaction artifacts are written locally or under the global rdx directory.
_Avoid_: Global-only artifacts, hidden storage location

**Artifact Lookup**:
rdx commands that locate transaction artifact directories by transaction ID or search pattern.
_Avoid_: Manual filesystem discovery, exact-only lookup

**Artifact Status**:
The local workflow state inferred from files present in a transaction artifact directory.
_Avoid_: Gateway status, ledger transaction status

**Status Command**:
The rdx command that queries Gateway transaction status and updates local submit result artifacts when present.
_Avoid_: Local-only status by default, stale submit result

**Transaction Manifest**:
An RTM file supplied by the caller for either the root transaction intent or a subintent.
_Avoid_: Manifest snapshot, inferred transaction intent

**Two-step Signing**:
The out-of-band transaction flow where agents first sign the intent hash, then sign the notary hash derived after intent signatures are attached.
_Avoid_: Single-step transaction signing, precomputed notary hash before intent signatures

**Notarize Command**:
The rdx command that derives a notary signing request after intent signatures have been supplied.
_Avoid_: notary-request command, single-step submit

**Notarize Preview**:
A Gateway preview run after intent and subintent signatures are collected and before the notary signing request is created.
_Avoid_: Notarizing unpreviewed signed intents, post-notary-only validation

**Notary Request File**:
A JSON file produced by the Notarize Command that contains the hash the notary must sign.
_Avoid_: Mutated prepared transaction file, separate notary-only schema

**Transaction Artifact Directory**:
The deterministic directory where rdx writes all files for a transaction workflow.
_Avoid_: Per-command transaction output path, stdout-only prepared transaction

**RTM Manifest**:
A Radix transaction manifest file used as the v1 transaction input for rdx.
_Avoid_: High-level transfer command, inferred transaction intent

**Transaction Manifest V2**:
The Radix transaction model used by every rdx transaction workflow.
_Avoid_: Manifest V1 transaction flow, mixed V1/V2 transaction support

**Subintent**:
A non-root Transaction Manifest V2 intent that can be independently signed by one or more agent or human signers and composed into a root transaction.
_Avoid_: Separate submitted transaction, root-only workflow

**Subintent ID**:
A local stable key used to join a subintent manifest, its signer set, and its signatures across rdx workflow files.
_Avoid_: Array position, duplicate subintent name

**Subintent Assembly**:
The rdx preparation step that composes a provided root RTM manifest with provided direct child subintent manifests into a Transaction Manifest V2 transaction.
_Avoid_: Business intent inference, placeholder-driven root manifest

**Subintent Order**:
The deterministic ordered list of subintent IDs used to map keyed rdx workflow files to Radix toolkit subintent arrays.
_Avoid_: Implicit object iteration, index-only subintent identity

**Authorization Analysis**:
The static analysis step that reports accounts requiring authorization for root and subintent manifests without resolving exact signer public keys.
_Avoid_: Public key discovery, signer inference from manifest

**Static Analysis File**:
A JSON artifact containing the full Radix Engine Toolkit static analysis output for a prepared transaction.
_Avoid_: Dropping raw analysis output, normalized-only analysis storage

**Add Signatures Command**:
The rdx command that validates external signature files and merges them into canonical transaction artifacts.
_Avoid_: Signature mutation during notarization, raw signature archive

## Relationships

- An **Agent-first CLI Wallet** signs, notarizes, previews, submits, and queries transactions for a Radix account.
- An **Agent-first CLI Wallet** prepares, previews, submits, and queries Radix account state without taking custody of private keys.
- An **Agent-first CLI Wallet** is not responsible for consumer wallet UX, mobile pairing, personas, hardware wallets, or full portfolio management.
- **radix-cli** publishes the **rdx** executable.
- The **rdx** executable uses an **Agent-first Interface** by default and reserves prompt-driven behavior for explicit interactive mode.
- An **Agent-first CLI Wallet** uses **Out-of-band Signing** for key custody: rdx prepares the hash, and the calling agent signs it outside the CLI.
- **Out-of-band Signing** starts with a **Signing Request** and completes when the agent supplies a matching signature.
- `tx prepare` produces **Generic Signing Requests** without requiring public keys.
- `tx prepare` produces **Generic Signing Requests** and matching **Signature Templates** by default.
- `tx notarize` produces a notary-scoped **Signing Request** and matching **Signature Template**.
- Account authorization **Signature Templates** use public key placeholders, while notary and notary-signatory templates prefill the known notary public key.
- **Signing Request** files are written under transaction artifacts by scope, such as `signing-requests/root/` and `signing-requests/subintents/<subintentId>/`.
- Account-scoped **Generic Signing Requests** are named with the full account address.
- Root and subintent **Generic Signing Requests** are created only for accounts reported by **Authorization Analysis** as requiring authorization.
- When `notaryIsSignatory` is true, `tx prepare` creates a `notarySignatory` **Signing Request** using the known notary public key.
- `notarySignatory` **Signing Requests** are generated from transaction header configuration, not **Authorization Analysis**.
- Every **Signing Request** and **Signature File** includes a **Signing Scope**.
- The signed payload for a **Signing Request** is `hash.hex`; the rest of the request is validation context.
- **Signing Request** hashes are encoded as `{ "id": string | null, "hex": string }`.
- **Signing Scope** is encoded as `{ "kind": "rootIntent" }`, `{ "kind": "subintent", "subintentId": "..." }`, `{ "kind": "notarySignatory" }`, or `{ "kind": "notary" }`.
- Notary **Signing Scope** is not account-scoped.
- CLI flags encode **Signing Scope** as `root`, `subintent:<subintentId>`, `notary-signatory`, or `notary`.
- A submit-ready **Signing Request** includes the expected **Signer Set**.
- A submit-ready **Signing Request** includes the expected **Notary Public Key**.
- rdx treats the **Notary Public Key** as a **Signatory Notary** by default.
- The **Notary Public Key** is required at transaction preparation through a **Notary File** or config entry.
- After preparation, later commands read notary public key and signatory settings from the **Prepared Transaction File**, not current config.
- A submit-ready **Signing Request** is produced after **Preview-before-Signing** unless explicitly bypassed.
- **Prepare Preview** runs without public keys, using signature-proof assumptions where supported.
- Failed **Prepare Preview** blocks transaction artifact creation.
- v1 preview results are not stored in transaction artifacts.
- An **Account Read Command** requires an account address and network, but does not require signing.
- An **Account Read Command** exposes Gateway-shaped data as an **Account Read Result** instead of hand-normalizing Gateway data into separate CLI DTOs.
- Account read schemas validate the CLI-owned command result envelope and keep Gateway-owned payload internals permissive.
- Fungible and non-fungible account balances are exposed through separate **Fungible Token Read Command** and **NFT Read Command** flows rather than one combined balance command.
- Because radix-cli has not been released, `rdx account balance` is replaced rather than kept as a compatibility alias.
- `rdx account show` exposes the Gateway state entity details response shape under the command result rather than a CLI-specific details wrapper.
- `rdx tx history` exposes the Gateway stream transactions response shape under the command result rather than a CLI-specific transaction list.
- **Virtual Account Address Derivation** does not query Gateway and does not prove the account currently exists on-ledger.
- **Virtual Account Address Derivation** is exposed as `rdx account derive --public-key <ed25519-public-key-hex>`.
- **Virtual Account Address Derivation** returns `accountAddress` plus `derivation: "virtualAccount"` in the command result.
- Invalid public keys for **Virtual Account Address Derivation** use an `INVALID_PUBLIC_KEY` structured error.
- The **Default Network** for rdx is Mainnet; test networks must be requested explicitly.
- A **Network-bound Transaction Workflow** starts at preparation; agents should verify the intended network before `tx prepare`.
- A **Network-bound Transaction Workflow** must not switch networks between preparation, signing, notarization, and submission.
- The **Embedded Agent Guide** tells agents to use `rdx config show` for resolved configuration instead of embedding config file schemas.
- The **Embedded Agent Guide** tells agents to use **Template Command** output for workflow file shapes instead of duplicating schemas.
- Invoking the **Submit Command** is the explicit acknowledgement to broadcast on the selected network.
- A **Prepared Transaction File** is the durable base artifact for **Two-step Signing** and submission.
- A **Prepared Transaction File** is the canonical source of truth for prepared transaction metadata and signing request paths.
- A **Prepared Transaction File** lists both signing request paths and signature template paths.
- A **Prepared Transaction File** never contains actual signatures.
- A **Prepared Transaction File** points to a **Transaction Intent File** instead of embedding the full transaction intent.
- The **Transaction Intent File** is named `transactionIntent.json`.
- The **Transaction Intent File** uses tx-tool's encoded `TransactionIntentV2` schema.
- **Two-step Signing** starts from a **Prepared Transaction File**, adds intent signatures, derives a notary signing request, then adds the notary signature.
- The **Notarize Command** performs the second preparation step in **Two-step Signing**.
- The **Notarize Command** writes a notary-scoped **Signing Request** and does not mutate the **Prepared Transaction File**.
- When `notaryIsSignatory` is true, the **Notarize Command** requires the `notarySignatory` signature before deriving the notary signing request.
- Failed **Notarize Preview** blocks notary signing request creation.
- The **Submit Command** depends on the **Prepared Transaction File** and **Signature File**, not the original RTM manifest.
- The **Submit Command** performs local artifact/signature validation and broadcast, but does not run another Gateway preview by default.
- The **Submit Command** writes `submitResult.json` after submission and status polling.
- The **Submit Command** stores the submitted notarized transaction payload as `notarizedTransaction.hex`.
- The **Submit Command** refuses to resubmit after a successful result, but can retry after failed, error, or unknown submit results and records attempts in `submitResult.json`.
- An **Intent Signature File** is the durable handoff from the agent back to rdx after intent signing.
- A **Notary Signature File** is the durable handoff from the agent back to rdx after notary signing.
- rdx accepts both single-signature and batch **Signature File** formats.
- **Signature File** entries repeat the signed hash and must match a generated **Signing Request**.
- **Signature File** entries may include `signingRequestPath` for auditability, but validation uses transaction ID, signing scope, hash, and public key.
- **Signing Request** files are not edited to add signatures; participants return separate **Signature File** responses.
- Filled **Signature Templates** are valid **Signature File** inputs to the **Add Signatures Command**.
- The **Add Signatures Command** rejects signatures that do not match a generated signing request.
- Duplicate signatures for the same signing request and public key are idempotent; differing duplicates keep the first signature and emit a warning.
- The **Add Signatures Command** accepts valid signatures in any order; completeness is checked by the **Notarize Command** and **Submit Command**.
- The **Submit Command** validates that signature file hashes match their prepared request files before assembling a transaction.
- **Local Signature Verification** is mandatory before the **Notarize Command** and **Submit Command** proceed.
- rdx generates transaction header defaults during preparation and accepts advanced overrides through a **Tx Header File** passed as `--tx-header`.
- Transaction preparation reads signing roles from a **Signers File** instead of signer or notary public key flags.
- A **Signers File** owns notary public key and signatory-notary settings; a **Tx Header File** owns non-role header overrides.
- A **Template Command** helps agents create valid file skeletons for rdx workflows.
- The **LLM Instructions Command** is embedded in rdx as `rdx llm` and prints Markdown by default.
- The **LLM Instructions Command** prints the static **Embedded Agent Guide**.
- The **Embedded Agent Guide** includes lifecycle and custody context, not only command syntax.
- The **Embedded Agent Guide** states that v1 supports Ed25519 only and rejects Secp256k1 or other curves in CLI workflow files.
- Signature templates can be generated from prepared transaction analysis to prefill transaction ID, signing scope, account, and hash.
- Signature template generation validates that root/subintent accounts are required by the selected signing scope, and rejects accounts for notary scope.
- A **CLI File Schema** uses camelCase fields, while command flags use kebab-case.
- Every **CLI File Schema** is a **Typed Workflow File**.
- Commands that write workflow files also print a **Command Result** to stdout.
- `tx prepare` **Command Result** includes transaction ID, artifact path, prepared file path, and generated signature template paths.
- `tx add-signatures` **Command Result** includes accepted count, warnings, and current signing completeness.
- `tx notarize` **Command Result** includes notary signing request and notary signature template paths.
- Failures are reported as **Structured Error** output by default.
- The default **Output Format** is JSON; text output is explicitly requested.
- An **Rdx Config File** can provide non-secret defaults, and command arguments override it.
- rdx resolves configuration from the nearest `.rdxconfig.json`, then `~/.rdx/config.json`, then built-in defaults.
- An **Rdx Config File** can define default signers and an **Artifacts Directory**.
- An **Artifact Scope** defaults to local and can be configured as global.
- **Artifact Lookup** supports direct transaction ID lookup and fuzzy or regex listing patterns.
- v1 **Artifact Lookup** pattern matching covers transaction ID, intent hash, and manifest source filename; network and status are exact filters.
- **Artifact Status** is used by default for transaction listing; Gateway status refresh is explicit.
- The **Status Command** queries Gateway by default and updates `submitResult.json` when a local transaction artifact directory exists.
- `tx list --with-network-status` is read-only unless an explicit update flag is supplied.
- A **Transaction Correlation ID** is derived from the prepared transaction intent hash rather than supplied by the caller.
- A transaction artifact directory includes copied **Transaction Manifest** files as `rootManifest.rtm` and `subintents/<subintentId>.rtm`.
- Accepted signatures are normalized into canonical `signatures.json` in the **Transaction Artifact Directory**.
- The canonical `signatures.json` contains signatures for all signing scopes, including root intent, subintents, and notary.
- The canonical signature file is overwritten with normalized, deduplicated, sorted content after successful merges.
- The **Add Signatures Command** is the mutation point for canonical signature artifacts.
- Creating a **Prepared Transaction File** writes to a **Transaction Artifact Directory**.
- When an **Artifacts Directory** is configured and no output path is provided, rdx generates a transaction folder named by **Transaction Correlation ID**.
- rdx fails rather than overwrites when a transaction artifact directory already exists.
- A v1 **Prepared Transaction File** is created from an **RTM Manifest**.
- Every rdx transaction workflow uses **Transaction Manifest V2**.
- `rdx tx prepare --manifest` supplies the root **Transaction Manifest**.
- A **Transaction Manifest V2** workflow may include **Subintents** with separate signer sets.
- **Subintent** workflow files are keyed by **Subintent ID** rather than arrays of id-bearing objects.
- A **Subintent ID** is also the Radix `NamedIntent` value used by the root manifest.
- A **Subintent ID** must match `^[A-Za-z][A-Za-z0-9_-]{0,63}$`.
- Signer declarations use **CLI Public Key** shape and signature files use **CLI Signature** shape; rdx maps both to tx-tool encodings internally.
- v1 **CLI Public Key** and **CLI Signature** values support Ed25519 only; other curves are deferred.
- Unknown **CLI Public Key** values in generated templates use `{ "curve": "Ed25519", "hex": "<replace-with-ed25519-public-key-hex>" }` and are rejected if submitted unchanged.
- v1 supports root transactions with direct child **Subintents** only; nested subintent graphs are out of scope.
- Root RTM manifests are provided by the caller and may contain normal root instructions with or without subintent yields.
- **Subintent Assembly** injects required `USE_CHILD` declarations for provided subintents and leaves the caller's root instructions otherwise unchanged.
- **Subintent Assembly** strictly validates that each provided **Subintent ID** is referenced by the root manifest and that each root `YIELD_TO_CHILD` has a provided subintent.
- **Authorization Analysis** can discover accounts requiring authorization, but expected public keys are supplied separately before signing requests are finalized.
- Failed **Authorization Analysis** blocks transaction artifact creation.
- Normalized **Authorization Analysis** is stored in the **Prepared Transaction File** because it explains generated signing requests.
- Full static analysis output is stored in a **Static Analysis File** for auditability.
- The **Static Analysis File** is named `staticAnalysis.json`.
- **Subintent Order** is persisted in prepared transaction artifacts and used for analysis mapping and subintent signature arrays.
- Participant signatures are the first participant input after preparation; there is no separate signer-claim stage in v1.
- Signing is complete when each required signing scope has valid signatures and a valid notary signature exists.
- Multiple signatures may satisfy the same account and signing scope; Gateway preview validates whether the collected signatures are sufficient.
- Local completeness means every generated account-scoped signing request has at least one valid signature; Gateway preview determines authorization sufficiency.

## Example Dialogue

> **Dev:** "Should the CLI wallet support browser wallet pairing?"
> **Domain expert:** "No — an **Agent-first CLI Wallet** is a local-key CLI signer and executor for agents, not a consumer wallet."

> **Dev:** "Should agents invoke `radix-cli` directly?"
> **Domain expert:** "They install **radix-cli**, but invoke the wallet through the **rdx** command."

> **Dev:** "Should `rdx tx submit` prompt for confirmation by default?"
> **Domain expert:** "No — the **Agent-first Interface** should be non-interactive by default and rely on explicit policy gates."

> **Dev:** "Where does `rdx` store the private key?"
> **Domain expert:** "It does not store it — **Out-of-band Signing** keeps the private key outside the CLI."

> **Dev:** "Can `rdx` print only the hash to sign?"
> **Domain expert:** "No — use a **Signing Request** so the agent has enough context to verify what it signs."

> **Dev:** "Can signatures be matched to transaction parts by filename alone?"
> **Domain expert:** "No — every signature is tied to a **Signing Scope**."

> **Dev:** "Does a notary-signatory signature replace the notary signature?"
> **Domain expert:** "No — `notarySignatory` signs the root intent hash, while `notary` signs the later notarization hash."

> **Dev:** "Can `rdx tx prepare` infer the signer from the account address?"
> **Domain expert:** "No — a submit-ready **Signing Request** must include the **Signer Set** that will produce signatures."

> **Dev:** "Should signer files include human-friendly signer aliases?"
> **Domain expert:** "No — v1 signer identity is the **Signer Public Key** only."

> **Dev:** "Should rdx workflow files use bare public key hex because tx-tool does?"
> **Domain expert:** "No — CLI files use **CLI Public Key** objects with `curve` and `hex`."

> **Dev:** "Should v1 accept Secp256k1 keys because the shape has a curve field?"
> **Domain expert:** "No — v1 is Ed25519-only, and other curves come later."

> **Dev:** "Should signature files use tx-tool's `{ curve, signature, signerPublicKey }` shape?"
> **Domain expert:** "No — keep CLI files consistent with **CLI Signature** objects and map to tx-tool internally."

> **Dev:** "Can v1 assume exactly one signer?"
> **Domain expert:** "No — the **Signer Set** may contain one or more public keys."

> **Dev:** "Can `rdx` notarize with its own internal key?"
> **Domain expert:** "No — notarization uses **Out-of-band Signing** and an explicit **Notary Public Key**."

> **Dev:** "Should `notary_is_signatory` default to false?"
> **Domain expert:** "No — rdx uses a **Signatory Notary** by default."

> **Dev:** "Should `rdx tx prepare` require an account address?"
> **Domain expert:** "No — account addresses are for **Account Read Commands**, while transaction preparation is driven by the RTM manifest and signer public key."

> **Dev:** "Should deriving an account address from a public key be exposed as a generic hash command?"
> **Domain expert:** "No — expose **Virtual Account Address Derivation** so the output is clearly a network-specific Radix account address."

> **Dev:** "Should an agent sign a transaction before Gateway preview succeeds?"
> **Domain expert:** "No — **Preview-before-Signing** is the default safety boundary for submit-ready requests."

> **Dev:** "Can `rdx tx prepare` skip preview because signer public keys are unknown?"
> **Domain expert:** "No — **Prepare Preview** runs without public keys using assumed signature proofs."

> **Dev:** "Should `rdx tx prepare` write artifacts when prepare preview fails?"
> **Domain expert:** "No — failed **Prepare Preview** blocks artifact creation."

> **Dev:** "Does `rdx tx history` build a complete portfolio timeline?"
> **Domain expert:** "No — it is an **Account Read Command** over Gateway account-scoped transaction history."

> **Dev:** "Can `rdx` default to Stokenet to be safer?"
> **Domain expert:** "No — the **Default Network** is Mainnet, and test networks are explicit."

> **Dev:** "Can an agent prepare on Stokenet and submit the artifact on Mainnet?"
> **Domain expert:** "No — each transaction is a **Network-bound Transaction Workflow**; prepare again for the intended network."

> **Dev:** "Should mainnet submit require an additional `--yes` or `--accept-risk` flag?"
> **Domain expert:** "No — the **Submit Command** itself is enough acknowledgement."

> **Dev:** "Should `rdx tx submit` run another Gateway preview by default?"
> **Domain expert:** "No — submit validates local artifacts and broadcasts; **Notarize Preview** is the final preview gate."

> **Dev:** "Can `rdx tx submit` recompile the manifest after signing?"
> **Domain expert:** "No — it submits from the **Prepared Transaction File** so the signed intent remains stable."

> **Dev:** "Can `rdx tx submit` read the original RTM to rebuild the transaction?"
> **Domain expert:** "No — after preparation, submission is independent of the original RTM."

> **Dev:** "Should notarization be a separate prepared artifact?"
> **Domain expert:** "Not as a separate transaction artifact — **Two-step Signing** derives the notary signing request after intent signatures are available."

> **Dev:** "Should the command be called `tx notary-request`?"
> **Domain expert:** "No — use the **Notarize Command**, `rdx tx notarize`."

> **Dev:** "Should `rdx tx notarize` update `prepared.json` in place?"
> **Domain expert:** "No — it writes a notary-scoped **Signing Request** so artifacts remain immutable."

> **Dev:** "Should notary signing use a separate schema from other signing requests?"
> **Domain expert:** "No — notary signing uses the same **Signing Request** schema with notary scope."

> **Dev:** "Should `rdx tx submit` accept signatures as repeated command flags?"
> **Domain expert:** "No — use a **Signature File** so multi-signer workflows stay deterministic and auditable."

> **Dev:** "Can intent and notary signatures share an untyped file format?"
> **Domain expert:** "No — use typed **Intent Signature File** and **Notary Signature File** formats and validate their hashes."

> **Dev:** "Can `rdx` rely on Gateway to reject bad signatures?"
> **Domain expert:** "No — **Local Signature Verification** catches wrong-key or wrong-hash files before broadcast."

> **Dev:** "Should header overrides be provided as many command flags?"
> **Domain expert:** "No — advanced header overrides belong in a **Tx Header File**."

> **Dev:** "Should signer and notary public keys be passed as command flags?"
> **Domain expert:** "No — signing roles belong in a **Signers File**."

> **Dev:** "Should `notaryIsSignatory` live in `tx-header.json`?"
> **Domain expert:** "No — notary role settings belong in the **Signers File**."

> **Dev:** "Should agents handwrite every JSON workflow file from docs?"
> **Domain expert:** "No — use a **Template Command** to generate skeleton files."

> **Dev:** "Should `rdx llm` follow the default JSON output rule?"
> **Domain expert:** "No — the **LLM Instructions Command** is embedded documentation and prints compact Markdown instructions by default."

> **Dev:** "Should `rdx llm` be generated from command metadata?"
> **Domain expert:** "No — v1 uses a static **Embedded Agent Guide** so domain-specific workflow rules are explicit."

> **Dev:** "Should rdx JSON files use snake_case because Radix payloads sometimes do?"
> **Domain expert:** "No — **CLI File Schema** fields use camelCase to match the TypeScript package."

> **Dev:** "Can rdx infer workflow file type from the command that reads it?"
> **Domain expert:** "No — every workflow file is a **Typed Workflow File** with explicit type and version."

> **Dev:** "Should `rdx tx prepare` only write the prepared file and print nothing?"
> **Domain expert:** "No — it writes the artifact and prints a **Command Result** for agents."

> **Dev:** "Can errors be free-form text because humans read CLIs?"
> **Domain expert:** "No — **Structured Error** output is required for agent-first automation."

> **Dev:** "Should account balances print as a human table by default?"
> **Domain expert:** "No — the default **Output Format** is JSON; humans can request text output."

> **Dev:** "Can `.rdxconfig.json` store private keys?"
> **Domain expert:** "No — an **Rdx Config File** stores only non-secret defaults."

> **Dev:** "Should the project config be called `rdx.config.json`?"
> **Domain expert:** "No — use the nearest `.rdxconfig.json`, then fall back to `~/.rdx/config.json`."

> **Dev:** "Can artifacts be stored globally instead of in the project?"
> **Domain expert:** "Yes — configure **Artifact Scope** as global; local remains the default."

> **Dev:** "Should agents manually scan `.rdx/tx` to find transaction artifacts?"
> **Domain expert:** "No — use **Artifact Lookup** commands such as `rdx tx path` and `rdx tx list`."

> **Dev:** "Should `rdx tx list --pattern` search every field in every artifact?"
> **Domain expert:** "No — v1 pattern matching covers transaction ID, intent hash, and manifest source filename, with exact filters for network and status."

> **Dev:** "Should `rdx tx list` call Gateway for every transaction by default?"
> **Domain expert:** "No — it lists **Artifact Status** by default and refreshes Gateway status only when requested."

> **Dev:** "Can artifact filenames alone identify which files belong to a transaction?"
> **Domain expert:** "No — use a transaction-id-derived **Transaction Correlation ID** across related artifacts."

> **Dev:** "Can the prepared transaction only reference the original manifest path?"
> **Domain expert:** "No — copy **Transaction Manifest** files into the artifact directory."

> **Dev:** "Should the root manifest artifact be named `manifest.rtm`?"
> **Domain expert:** "No — use `rootManifest.rtm`, with child manifests under `subintents/<subintentId>.rtm`."

> **Dev:** "Can `rdx tx prepare` overwrite an existing transaction artifact directory?"
> **Domain expert:** "No — existing artifact directories fail by default to protect audit trails."

> **Dev:** "Should `rdx tx prepare` accept `--out` for prepared files?"
> **Domain expert:** "No — transaction workflows write to a **Transaction Artifact Directory**."

> **Dev:** "Should v1 include `rdx xrd send`?"
> **Domain expert:** "No — v1 is **RTM Manifest** first so transaction intent stays explicit and auditable."

> **Dev:** "Should the root manifest flag be called `--root-manifest`?"
> **Domain expert:** "No — use `--manifest` for the root **Transaction Manifest** input."

> **Dev:** "Can rdx choose V1 or V2 based on the manifest?"
> **Domain expert:** "No — all rdx transaction workflows use **Transaction Manifest V2**."

> **Dev:** "Are subintents separate transactions submitted on their own?"
> **Domain expert:** "No — a **Subintent** is independently signed and composed into a root transaction workflow."

> **Dev:** "Should subintents be matched by array position across files?"
> **Domain expert:** "No — use **Subintent ID** keys across subintent, signer, and signature files."

> **Dev:** "Should `subintents.json` support a separate `namedIntent` field?"
> **Domain expert:** "No — the **Subintent ID** is the `NamedIntent` value."

> **Dev:** "Can a subintent ID contain spaces or RTM syntax characters?"
> **Domain expert:** "No — **Subintent ID** values use a conservative identifier format."

> **Dev:** "Should v1 support nested subintent graphs?"
> **Domain expert:** "No — v1 supports direct child **Subintents** only."

> **Dev:** "Should users precompute child intent IDs before writing the root manifest?"
> **Domain expert:** "No — provide root and child manifests separately and let **Subintent Assembly** inject `USE_CHILD` declarations."

> **Dev:** "Can rdx infer missing subintents from business context?"
> **Domain expert:** "No — the caller provides root and subintent manifests, and **Subintent Assembly** only validates and composes them."

> **Dev:** "Can static analysis tell rdx exactly which public keys must sign?"
> **Domain expert:** "No — **Authorization Analysis** reports accounts requiring authorization, not exact signer public keys."

> **Dev:** "Can rdx rely on JSON object order to map subintents to toolkit analysis arrays?"
> **Domain expert:** "No — persist **Subintent Order** explicitly."

> **Dev:** "Should participants provide separate signer claims before signing?"
> **Domain expert:** "No — participant signatures are the first participant input after preparation in v1."

## Flagged Ambiguities

- "Wallet" can mean a consumer wallet or the local-key CLI signer in this project — resolved: use **Agent-first CLI Wallet** for the CLI product.
- Message signing was considered for v1 — resolved: v1 focuses on transaction workflows and account read commands, not arbitrary message signing.
- "LLM" means coding-agent-oriented embedded CLI instructions in this project — resolved: use **LLM Instructions Command** for the `rdx llm` command.
