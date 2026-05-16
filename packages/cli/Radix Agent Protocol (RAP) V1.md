# Radix Agent Protocol (RAP) V1

Status: draft current implementation, not a final external protocol.

Radix Agent Protocol V1 is a draft state-machine protocol for coordinating Radix Transaction Manifest V2 workflows between agents, signers, notaries, and a Radix network. The current CLI is an adapter over this protocol; its commands and file paths are implementation details.

This document captures the current data model and transaction state machine implemented by `packages/cli/src`.

While this draft currently lives beside the CLI implementation, RAP is not a CLI protocol. Once the protocol stabilizes, its documentation should move to a protocol-level docs location or dedicated package, with the CLI documented as one adapter.

## Why RAP Exists

Autonomous agents need a deterministic way to move a Radix transaction from intent construction to signing, notarization, submission, and status observation without giving private keys to the transaction coordinator.

RAP exists to:

- Define typed payloads for each transaction phase.
- Make every required signature explicit by transaction, scope, account, and hash.
- Keep private key custody outside the transaction coordinator.
- Allow signatures to arrive asynchronously from one or more agents.
- Preserve enough state to resume, audit, and submit a workflow without rebuilding it from the original RTM input.
- Keep network, transaction, signature, notarization, and status data bound to one workflow.

RAP is for coding agents, scripts, and local automation that can inspect JSON, sign Ed25519 hashes out of band, and advance a transaction through a finite state machine.

RAP is not a consumer wallet protocol, key-management format, browser wallet pairing protocol, or CLI help schema.

## Draft Scope

RAP V1 currently covers:

- Radix Transaction Manifest V2 only.
- One root transaction intent plus direct child subintents only.
- Ed25519 public keys and signatures only.
- Out-of-band signing only.
- JSON payloads with camelCase fields.
- Transaction workflow state, not generic account indexing.

Every public RAP payload is typed and versioned:

```ts
type RapPayload = {
  type: string;
  version: 1;
};
```

## State Machine Overview

RAP transaction workflows move through these phases:

```text
DraftInputs
  -> Prepared
  -> IntentSigning
  -> IntentSignaturesComplete
  -> NotaryRequested
  -> NotarySigning
  -> NotarySignatureComplete
  -> Submitted
```

Network status observation is an overlay result, not a mainline progression state. A status query may attach to any local workflow state or exist without a local transaction workflow.

## Primitive Types

```ts
type Network = "mainnet" | "stokenet";

type PublicKey = {
  curve: "Ed25519";
  hex: string; // 64 hex characters
};

type SignatureValue = {
  curve: "Ed25519";
  hex: string; // 128 hex characters
};

type Hash = {
  id: string;
  hex: string;
};

type TransactionId = string; // RAP correlation ID; after preparation this is the Radix intent hash identifier

type SigningScope =
  | { kind: "rootIntent" }
  | { kind: "subintent"; subintentId: string }
  | { kind: "notarySignatory" }
  | { kind: "notary" };

type SubintentId = string; // ^[A-Za-z][A-Za-z0-9_-]{0,63}$
```

Generated signature templates may use placeholders:

```text
<replace-with-ed25519-public-key-hex>
<replace-with-ed25519-signature-hex>
```

Placeholders are allowed only in templates. They are invalid in imported signatures.

## Phase 1: DraftInputs

`DraftInputs` is the pre-preparation state. It contains the data required to build and analyze a transaction, but it has no canonical transaction ID yet.

```ts
type DraftInputsState = {
  state: "DraftInputs";
  network: Network;
  rootManifest: RootManifestInput;
  subintents?: SubintentsInput;
  notary: NotaryInput;
};

type RootManifestInput = {
  kind: "rootManifest";
  sourceName?: string;
  rtm: string;
};

type SubintentsInput = {
  type: "subintents";
  version: 1;
  subintents: Record<
    SubintentId,
    {
      manifest: string; // inline RTM text
    }
  >;
};

type NotaryInput = {
  type: "notary";
  version: 1;
  publicKey: PublicKey;
  notaryIsSignatory?: boolean;
};
```

Rules:

- `network` is selected before preparation and remains fixed for the workflow.
- `notaryIsSignatory` defaults to `true`.
- `rootManifest.rtm` and each subintent `manifest` are inline RTM text in RAP; file paths are adapter inputs loaded before this state.
- Each `SubintentId` must use the conservative identifier pattern.
- The root manifest must contain `YIELD_TO_CHILD NamedIntent("<subintentId>")` for every provided subintent.
- Provided but unreferenced subintents are invalid.
- Referenced but missing subintents are invalid.

Transition output: `Prepared`.

## Phase 2: Prepared

`Prepared` is the first canonical transaction state. It has a transaction ID, a compiled transaction intent, static analysis, authorization requirements, and signing requests.

```ts
type PreparedState = {
  state: "Prepared";
  prepared: PreparedTransaction;
  transactionIntent: TransactionIntentArtifact;
  staticAnalysis: StaticAnalysisArtifact;
  signingRequests: SigningRequest[];
  signatureTemplates: SignatureTemplate[];
  copiedManifests: CopiedManifestSet;
};

type PreparedTransaction = {
  type: "preparedTransaction";
  version: 1;
  transactionId: TransactionId;
  network: Network;
  intentHash: Hash;
  subintentOrder: SubintentId[];
  notaryPublicKey: PublicKey;
  notaryIsSignatory: boolean;
};

type AuthorizationAnalysis = {
  rootIntent: string[];
  subintents: Record<SubintentId, string[]>;
};

type TransactionIntentArtifact = {
  type: "transactionIntent";
  version: 1;
  transactionId: TransactionId;
  encoded: {
    kind: "transactionIntentV2";
    value: TransactionIntentV2Stored;
    compiledHex: string;
  };
};

type TransactionIntentV2Stored = {
  transactionHeader: {
    notaryPublicKey: string;
    notaryIsSignatory: boolean;
    tipBasisPoints: number;
  };
  rootIntentCore: IntentCoreV2Stored;
  nonRootSubintents: Array<{ intentCore: IntentCoreV2Stored }>;
};

type IntentCoreV2Stored = {
  header: {
    networkId: number;
    startEpochInclusive: number;
    endEpochExclusive: number;
    minProposerTimestampInclusive?: number;
    maxProposerTimestampExclusive?: number;
    intentDiscriminator: number;
  };
  instructions: string;
  blobs: [];
  message: unknown;
  children: string[];
};

type StaticAnalysisArtifact = {
  type: "staticAnalysis";
  version: 1;
  transactionId: TransactionId;
  authorization: AuthorizationAnalysis;
  rawAnalysis?: unknown;
};

type CopiedManifestSet = {
  rootManifest: string;
  subintents: Record<SubintentId, string>;
};
```

Prepared signing request shapes:

```ts
type SigningRequest = {
  type: "signingRequest";
  version: 1;
  transactionId: TransactionId;
  scope: SigningScope;
  account: string | null; // constrained by SigningScope invariants
  hash: Hash;
};

type SignatureTemplate = {
  type: "signatureTemplate";
  version: 1;
  transactionId: TransactionId;
  scope: SigningScope;
  account: string | null; // constrained by SigningScope invariants
  hash: Hash;
  publicKey: PublicKey;
  signature: SignatureValue;
};
```

`SignatureTemplate` is a RAP handoff payload for out-of-band signers. It is not merely an adapter convenience: it carries the request context forward while giving the signer explicit public key and signature fields to fill.

Prepared state includes these request scopes:

- `rootIntent` for each root account requiring authorization.
- `subintent` for each direct child subintent account requiring authorization.
- `notarySignatory` if the notary also signs the root intent.

Prepared state does not yet include a `notary` signing request. That request can only be derived after intent and subintent signatures are attached.

Transition input: zero or more signature payloads.

Transition output: `IntentSigning`.

## Phase 3: IntentSigning

`IntentSigning` is a prepared workflow with a canonical signature file that may be incomplete.

```ts
type IntentSigningState = {
  state: "IntentSigning";
  prepared: PreparedTransaction;
  transactionIntent: TransactionIntentArtifact;
  signingRequests: SigningRequest[];
  signatures: SignatureFile;
  completeness: SignatureCompleteness;
};

type SignatureFile = {
  type: "signatureFile";
  version: 1;
  transactionId: TransactionId;
  signatures: SignatureEntry[];
};

type SignatureEntry = {
  scope: SigningScope;
  account: string | null; // constrained by SigningScope invariants
  hash: Hash;
  publicKey: PublicKey;
  signature: SignatureValue;
};

type SignatureCompleteness = {
  required: SigningRequest[];
  complete: SigningRequest[];
  missing: SigningRequest[];
};
```

`SignatureFile` is used both as an import payload and as the canonical signature state shape. As a transition input, it is a patch: valid entries are merged into the workflow's canonical `signatures` state rather than replacing all existing signatures.

Accepted transition inputs:

- Filled `SignatureTemplate`.
- `SignatureFile`.

Signature import rules:

- The payload transaction ID must match the prepared transaction.
- The signature must match a known signing request by transaction ID, scope, account, `hash.id`, and `hash.hex`.
- Placeholder public keys or signatures are rejected.
- The Ed25519 signature must verify against `hash.hex` and `publicKey.hex`.
- Duplicate signatures are normalized into one canonical `SignatureFile`.
- Differing duplicate signatures for the same identity are ignored with a warning.
- Multiple signatures may target the same signing request identity when they use different public keys.
- Deduplication is by signing request identity plus public key, not by signing request identity alone.

Multisig note:

- RAP supports multiple `SigningRequest`s and multiple `SignatureEntry`s for one transaction workflow.
- RAP supports multiple signatures across root intent, direct child subintent, notary-signatory, and notary scopes.
- RAP does not compute Radix authorization thresholds or exact signer sets in this draft; Radix manifests, static analysis, and on-ledger access rules determine what authorization is required.

Transition output:

- Stay in `IntentSigning` while any prepared signing request is missing.
- Move to `IntentSignaturesComplete` when all prepared signing requests are satisfied.

## Phase 4: IntentSignaturesComplete

`IntentSignaturesComplete` means the root intent, direct child subintents, and any notary-signatory authorization have all been signed.

```ts
type IntentSignaturesCompleteState = {
  state: "IntentSignaturesComplete";
  prepared: PreparedTransaction;
  transactionIntent: TransactionIntentArtifact;
  signatures: SignatureFile;
};
```

Rules:

- Every prepared `SigningRequest` has at least one matching `SignatureEntry`.
- No notary request exists yet unless the workflow has already advanced and returned to signature import.
- This state is required before a notary signing request can be generated.
- Adapters may derive this state from signature completeness instead of persisting a separate payload, but RAP treats it as a named state-machine boundary.

Transition output: `NotaryRequested`.

## Phase 5: NotaryRequested

`NotaryRequested` is created by attaching intent and subintent signatures to the Transaction Intent V2, previewing the signed intent, and deriving the notary hash.

```ts
type NotaryRequestedState = {
  state: "NotaryRequested";
  prepared: PreparedTransaction;
  transactionIntent: TransactionIntentArtifact;
  signedTransactionIntent: SignedTransactionIntentArtifact;
  signatures: SignatureFile;
  notarySigningRequest: SigningRequest & {
    scope: { kind: "notary" };
    account: null;
  };
  notarySignatureTemplate: SignatureTemplate & {
    scope: { kind: "notary" };
    account: null;
  };
};

type SignedTransactionIntentArtifact = {
  type: "signedTransactionIntent";
  version: 1;
  transactionId: TransactionId;
  encoded: {
    kind: "signedTransactionIntentV2";
    compiledHex: string;
  };
};
```

Rules:

- The notary signing request signs the signed transaction intent hash, not the original transaction intent hash.
- The notary template contains the expected notary public key.
- The notary request uses the same `SigningRequest` shape as other signing requests, with `scope.kind = "notary"`.

Transition input: notary signature payload.

Transition output: `NotarySigning`.

## Phase 6: NotarySigning

`NotarySigning` is a notary-requested workflow whose canonical signature file may or may not contain the notary signature.

```ts
type NotarySigningState = {
  state: "NotarySigning";
  prepared: PreparedTransaction;
  transactionIntent: TransactionIntentArtifact;
  signedTransactionIntent: SignedTransactionIntentArtifact;
  signatures: SignatureFile;
  notarySigningRequest: SigningRequest & {
    scope: { kind: "notary" };
    account: null;
  };
  completeness: SignatureCompleteness;
};
```

The same signature import rules from `IntentSigning` apply. The required request set now includes the notary request.

Transition output:

- Stay in `NotarySigning` while the notary request is missing.
- Move to `NotarySignatureComplete` when all requests, including notary, are satisfied.

## Phase 7: NotarySignatureComplete

`NotarySignatureComplete` is the submit-ready local state.

```ts
type NotarySignatureCompleteState = {
  state: "NotarySignatureComplete";
  prepared: PreparedTransaction;
  transactionIntent: TransactionIntentArtifact;
  signedTransactionIntent: SignedTransactionIntentArtifact;
  signatures: SignatureFile;
};
```

Rules:

- Every generated signing request has a matching signature.
- A `scope.kind = "notary"` signature exists.
- The workflow can be compiled into a Notarized Transaction V2 without the original draft inputs.
- Adapters may derive this state from signature completeness instead of persisting a separate payload, but RAP treats it as the submit-ready state-machine boundary.

Transition output: `Submitted`.

## Phase 8: Submitted

`Submitted` records the exact notarized transaction payload and the network submission result.

```ts
type SubmittedState = {
  state: "Submitted";
  prepared: PreparedTransaction;
  notarizedTransaction: NotarizedTransactionArtifact;
  submitResult: SubmitResult;
};

type NotarizedTransactionArtifact = {
  type: "notarizedTransaction";
  version: 1;
  transactionId: TransactionId;
  compiledHex: string;
};

type SubmitResult = {
  type: "submitResult";
  version: 1;
  transactionId: TransactionId;
  networkStatus: NetworkTransactionStatus;
  attempts: NetworkStatusAttempt[];
};

type NetworkTransactionStatus = {
  transactionId: TransactionId;
  status: string;
  statusDescription: string;
  errorMessage: string | null;
  checkedAt: string;
};

type NetworkStatusAttempt = {
  checkedAt: string;
  status: string;
  statusDescription: string;
  errorMessage: string | null;
};
```

Rules:

- A workflow with a previous `CommittedSuccess` submit result must not be submitted again.
- The submitted payload is the compiled Notarized Transaction V2.
- RAP treats the submitted payload as a typed `NotarizedTransactionArtifact`; adapters may persist that payload as raw hex when the transaction ID is already provided by surrounding state.
- Submission status is recorded as attempts, not overwritten as a single value.
- `Submitted` includes `submitResult` because the current submission transition produces a durable network response; later observations may append additional attempts through the observation overlay.

`Submitted` is the terminal local transaction workflow state in RAP V1. Network status can continue to change and is captured through observation overlays.

## Observation Overlay

`Observed` captures Gateway status observations without advancing the main transaction state machine.

```ts
type ObservedState = {
  state: "Observed";
  transactionId: TransactionId;
  localWorkflow?:
    | PreparedState
    | IntentSigningState
    | IntentSignaturesCompleteState
    | NotaryRequestedState
    | NotarySigningState
    | NotarySignatureCompleteState
    | SubmittedState;
  networkStatus: NetworkTransactionStatus;
  updatedSubmitResult?: SubmitResult;
};
```

Rules:

- Status is keyed by transaction ID / intent hash.
- A status observation may exist without local workflow artifacts.
- If local workflow state exists and observation is not read-only, the observation is appended to `SubmitResult.attempts`.
- Observation does not imply that a workflow is submitted, complete, or safe to advance.

## Cross-phase Invariants

- `transactionId` is the RAP workflow correlation ID after preparation; in the current Radix transaction flow it is the Radix intent hash identifier used for Gateway status.
- `network` is selected before preparation and must not change.
- Every signature is scoped.
- Every imported signature must match an existing signing request.
- Every RAP hash used for prepared state, signing requests, signatures, notarization, and status has a non-null `id`.
- `rootIntent` and `subintent` signing requests require `account`; `notarySignatory` and `notary` signing requests use `account: null`.
- `SignatureEntry.publicKey` is the signer identity in RAP; signer labels and roles are adapter or coordination metadata outside the core protocol.
- `notarySignatory` and `notary` are distinct scopes.
- `notarySignatory` signs the root intent hash.
- `notary` signs the signed transaction intent hash.
- Subintent ordering is explicit through `subintentOrder`.
- Prepared workflows are resumable without the original RTM input.
- `PreparedTransaction.notaryPublicKey` and `notaryIsSignatory` are protocol-level workflow metadata even though the encoded transaction header also contains notary data.
- `TransactionIntentArtifact.encoded.value` is RAP-owned Transaction Intent V2 stored data for this draft.

## Transition Events

RAP defines transition events separately from adapter commands. An adapter may expose these as commands, API calls, queue messages, or local function calls, but the protocol event names and state transitions remain the same.

```ts
type RapTransitionEvent =
  | PrepareTransactionEvent
  | ImportIntentSignaturesEvent
  | RequestNotarySignatureEvent
  | ImportNotarySignatureEvent
  | SubmitTransactionEvent
  | ObserveTransactionEvent;

type PrepareTransactionEvent = {
  event: "PrepareTransaction";
  input: DraftInputsState;
  output: PreparedState;
};

type ImportIntentSignaturesEvent = {
  event: "ImportIntentSignatures";
  input: {
    state: PreparedState | IntentSigningState;
    signatures: SignatureTemplate | SignatureFile;
  };
  output: IntentSigningState | IntentSignaturesCompleteState;
};

type RequestNotarySignatureEvent = {
  event: "RequestNotarySignature";
  input: IntentSignaturesCompleteState;
  output: NotaryRequestedState;
};

type ImportNotarySignatureEvent = {
  event: "ImportNotarySignature";
  input: {
    state: NotaryRequestedState | NotarySigningState;
    signatures: SignatureTemplate | SignatureFile;
  };
  output: NotarySigningState | NotarySignatureCompleteState;
};

type SubmitTransactionEvent = {
  event: "SubmitTransaction";
  input: NotarySignatureCompleteState;
  output: SubmittedState;
};

type ObserveTransactionEvent = {
  event: "ObserveTransaction";
  input: {
    transactionId: TransactionId;
    localWorkflow?: PreparedState | IntentSigningState | IntentSignaturesCompleteState | NotaryRequestedState | NotarySigningState | NotarySignatureCompleteState | SubmittedState;
    readOnly?: boolean;
  };
  output: ObservedState;
};
```

Failed transitions return RAP errors at the protocol boundary:

```ts
type RapTransitionError =
  | {
      type: "rapError";
      code: "InvalidState";
      message: string;
      state?: string;
    }
  | {
      type: "rapError";
      code: "InvalidPayload";
      message: string;
      details?: unknown;
    }
  | {
      type: "rapError";
      code: "PreviewRejected";
      message: string;
      phase: "PrepareTransaction" | "RequestNotarySignature";
      details?: unknown;
    }
  | {
      type: "rapError";
      code: "MissingSignature";
      message: string;
      request: SigningRequest;
    }
  | {
      type: "rapError";
      code: "InvalidSignature";
      message: string;
      signature: SignatureEntry;
    }
  | {
      type: "rapError";
      code: "SubmissionRejected";
      message: string;
      transactionId: TransactionId;
      details?: unknown;
    }
  | {
      type: "rapError";
      code: "ObservationFailed";
      message: string;
      transactionId: TransactionId;
      details?: unknown;
    };
```

Adapter errors such as missing files, invalid config, permission failures, or command-line parsing failures are outside RAP unless they are translated into one of these protocol errors.

Transition event rules:

- `PrepareTransaction` is the only event that creates a canonical `transactionId`.
- `ImportIntentSignatures` must not accept `notary` signatures before `RequestNotarySignature` has produced a notary request.
- `RequestNotarySignature` must fail unless intent signature completeness is satisfied.
- `ImportNotarySignature` uses the same signature validation rules as intent signature import, but the required request set includes the notary request.
- Intent signature import and notary signature import remain separate protocol events so the two-step signing boundary stays explicit.
- `SubmitTransaction` must fail unless every generated signing request, including the notary request, is complete.
- `ObserveTransaction` is an overlay event; it does not advance signing, notarization, or submission state.

## Preview Gates

RAP has two safety gates in the current implementation:

| Phase | Preview input | Signature proof assumption | Purpose |
| --- | --- | --- | --- |
| DraftInputs -> Prepared | Unsigned Transaction Intent V2 preview | Assume all signature proofs | Catch manifest and execution failures before signing requests are emitted. |
| IntentSignaturesComplete -> NotaryRequested | Signed Transaction Intent V2 preview | Use real signer public keys | Catch signed-intent failures before the notary signs. |

Both previews skip epoch checks and use free credit in the current implementation.

Preview results are transition gates, not RAP state artifacts. A successful preview allows the transition to continue; a failed preview rejects the transition. RAP V1 does not store preview receipts in state payloads.

## Current Adapter Notes

The current `rdx` CLI adapter persists RAP state as JSON files under a transaction artifact directory. These paths are implementation details, but the major persisted shapes map as follows:

| RAP shape | Current persisted representation |
| --- | --- |
| `PreparedTransaction` | `prepared.json` |
| `TransactionIntentArtifact` | `transactionIntent.json` |
| `StaticAnalysisArtifact` | `staticAnalysis.json`; current adapter stores full toolkit analysis and derives authorization into `prepared.json` |
| `SigningRequest[]` | `signing-requests/...` |
| `SignatureTemplate[]` | `signature-templates/...` |
| `SignatureFile` | `signatures.json` |
| `SignedTransactionIntentArtifact` | `signedTransactionIntent.json` |
| `NotarizedTransactionArtifact` | `notarizedTransaction.hex` raw adapter encoding |
| `SubmitResult` | `submitResult.json` |

The CLI command names, flags, default output rendering, and artifact paths should not be treated as the RAP model itself.

Current adapter-only fields include `manifestSourceFile`, `transactionIntentPath`, `staticAnalysisPath`, `signingRequests`, `signatureTemplates`, and `signingRequestPath`. They exist to locate JSON files on disk, not to define RAP state.

The current adapter also duplicates authorization data into `prepared.json`; RAP treats `StaticAnalysisArtifact.authorization` as the protocol source of truth.

The current adapter contains defensive fallback paths for missing hash IDs; RAP treats missing hash IDs as invalid protocol state.

The current adapter accepts a `batchSignatureFile` wrapper and expands it into repeated `SignatureFile` imports. RAP core treats batching as transport ergonomics rather than a distinct state-machine payload.

The current adapter stores `TransactionIntentArtifact.encoded.value` in the same shape RAP documents for this draft.

## Open Questions For Draft Hardening

- None currently captured.
