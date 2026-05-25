# x402 Radix Reference Design

The x402 Radix reference design demonstrates agent-paid HTTP resources using Radix Transaction Manifest V2 payment flows.

## Language

**x402 Sponsored Payment**:
An x402 payment flow where the payer signs a payment Subintent and a facilitator wraps it in a root transaction that pays network fees.
_Avoid_: Non-sponsored x402 transaction, client-paid gas payment

**x402 Reference Implementation**:
A runnable server-side example that demonstrates protected-resource settlement for payer-signed Radix Subintents.
_Avoid_: Design-only reference, protocol notes

**x402 Example Package**:
The single workspace package under `examples/x402` that contains the Hono server, payment middleware, protected markdown file, and shared example helpers.
_Avoid_: Split server package, separate middleware package

**x402 Payment Middleware**:
A Hono middleware that protects a route by issuing x402 payment requirements, validating a payment payload, settling the payment, and allowing the route handler to serve the resource.
_Avoid_: Standalone payment route, route-specific payment handler

**Protected Route Surface**:
The public HTTP surface of the example server, limited to routes that either return `402` requirements or serve the protected resource after payment.
_Avoid_: Public facilitator API, separate verify endpoint, separate settle endpoint

**Protected Markdown Resource**:
A markdown document served by the Hono route only after an x402 payment has settled.
_Avoid_: Protected JSON resource, static public markdown

**Protected Markdown File**:
The local `.md` file read by the protected route after payment succeeds.
_Avoid_: Inline route content, generated markdown response

**Reusable Payment Middleware**:
The Hono middleware shape that can protect arbitrary routes while the reference demonstrates it on one markdown route.
_Avoid_: Single-route payment code, framework package abstraction

**Fixed Route Payment Terms**:
The static payment configuration attached to the protected markdown route for the v1 reference.
_Avoid_: Dynamic pricing, request-dependent payment requirements

**Absolute Resource URL**:
The fully qualified URL of the protected resource used in payment requirements and settlement cache identity.
_Avoid_: Route-relative resource URL, handler-local path

**Structured Payment Requirements**:
Machine-readable x402 terms that describe the required Radix payment without asking the payer to trust server-authored transaction manifest text.
_Avoid_: Arbitrary RTM signing request, template-as-authority

**Payment Subintent Construction**:
The payer-side step that deterministically builds the x402 payment Subintent from Structured Payment Requirements.
_Avoid_: Signing server-provided RTM, facilitator-authored payer manifest

**Payer Manifest Construction**:
The payer-side generation of both payment Subintent RTM and preview root RTM from Structured Payment Requirements, normally through generic `rdx subintent` commands.
_Avoid_: Server-authored RTM as normal path, template-only construction

**Unit-First Payment Coverage**:
Deterministic non-live tests for x402 manifest generation, payment hashing, cache identity, config placeholder rejection, and exact Subintent validation.
_Avoid_: Mainnet-only verification, live-first testing

**Advisory Payment Manifest Template**:
An optional placeholder RTM example derived from Structured Payment Requirements to help agents render or debug the expected Subintent shape.
_Avoid_: Canonical payment instruction, signable server manifest

**Advisory Preview Root Manifest Template**:
An optional placeholder RTM example supplied with payment requirements so capable agents can run best-effort Subintent preview before signing.
_Avoid_: Mandatory settlement manifest, canonical server root transaction

**Authoritative Payment Payload**:
The x402 retry payload field containing the signed partial transaction that the facilitator decodes and validates for settlement.
_Avoid_: Redundant payer metadata, client-asserted subintent hash

**Signed Partial Transaction Inspection**:
The facilitator-side operation that decodes a signed partial transaction, extracts the Subintent manifest and header, computes its hash, and derives payer details for validation.
_Avoid_: Trusting HTTP metadata, string-parsing payment payload hints

**Validated Subintent Settlement**:
The server-side path where a valid signed payment Subintent is accepted only as input to settlement, then wrapped, submitted, and observed by the facilitator.
_Avoid_: Fire-and-forget payment acceptance, unsigned payment promise

**Server Payment Validation**:
The facilitator-side validation of a signed payment Subintent and wrapped transaction using static checks and Gateway preview before submission.
_Avoid_: Payload-shape-only validation, payer allowlist

**Exact Payment Subintent Shape**:
The required v1 instruction sequence for a sponsored x402 Radix payment Subintent.
_Avoid_: Equivalent manifest variation, flexible instruction matching

**Payment Release Boundary**:
The settlement state required before the protected resource is served to the requester.
_Avoid_: Gateway-submitted boundary, optimistic payment acceptance

**Settlement Record**:
An example-local record that remembers a successful payment settlement for a signed Subintent and payment requirement pair.
_Avoid_: Protocol receipt, durable payment ledger

**Settlement Cache Key**:
A hash derived from the Subintent hash, payment requirements hash, and protected resource URL.
_Avoid_: Subintent-only cache key, route-only cache key

**Payment Requirements Hash**:
A canonical hash over the normalized payment semantics, excluding advisory or debug fields.
_Avoid_: Full response JSON hash, advisory template hash

**Facilitator Notary Binding**:
The relationship between the facilitator's configured notary key, its virtual signature badge in payment requirements, and the root transaction's signatory notary.
_Avoid_: Arbitrary parent signer, unbound facilitator identity

**Facilitator Notary Key**:
The configured notary key used by the facilitator to notarize the sponsored root transaction and satisfy the payer Subintent's parent check.
_Avoid_: Fee payer account, pay-to account

**Fee Payer Account**:
The configured account that locks XRD fees for the sponsored root transaction.
_Avoid_: Facilitator notary identity, merchant account

**Pay-To Account**:
The configured account that receives the protected-resource payment.
_Avoid_: Fee payer account, notary account

**Reference Network**:
The Radix network targeted by the runnable x402 reference implementation.
_Avoid_: Stokenet-only example, implicit test network

**Mainnet Config Template**:
An example configuration file with placeholders for every Mainnet account, key, asset, and amount required by the x402 reference.
_Avoid_: Generated Mainnet defaults, hidden configuration

**Placeholder Rejection**:
The runtime check that refuses to issue payment requirements or settle payments while any Mainnet config placeholder remains.
_Avoid_: Best-effort placeholder use, demo fallback values

**Payer rdx Workflow**:
The generic `rdx subintent prepare` and `rdx subintent build` workflow a payer uses to produce the signed partial transaction consumed by the x402 server.
_Avoid_: x402-specific CLI command, example-specific agent client

**Signed Subintent Build**:
The payer-side use of `rdx subintent build` to produce the signed partial transaction for the payment payload.
_Avoid_: Notarized transaction assembly, root transaction submission

**Payer Payment Signing**:
The payer's signing step where it signs the prepared Subintent hash before building the x402 payment payload.
_Avoid_: Server-side payer signing, interactive wallet signing

**Payer Account**:
The Radix account address selected by the payer as the source of the x402 payment.
_Avoid_: Server-selected payer account, facilitator payer account

**Valid Payer**:
Any payer account whose signed Subintent satisfies the payment requirements, passes server validation, and settles successfully.
_Avoid_: Payer allowlist, pre-approved customer account

**x402 Preview Root Manifest**:
The best-effort root manifest used by the agent-side preview to exercise facilitator parent binding and payment deposit behavior before signing.
_Avoid_: Mandatory settlement manifest, naked Subintent preview, unrelated preview transaction

**Preview Root Fallback**:
The agent-side order for Subintent preview: build a preview root from structured requirements when possible, use an advisory template if needed, and use no-preview only as the last case.
_Avoid_: Silent preview skip, template-first preview

## Relationships

- An **x402 Sponsored Payment** uses the **Agent-first CLI Wallet** to produce the payer-signed **Subintent** and leaves root transaction wrapping, gas payment, submission, and polling to the facilitator.
- The **x402 Reference Implementation** exercises the **x402 Sponsored Payment** flow as executable code rather than documentation alone.
- The **x402 Reference Implementation** lives in one **x402 Example Package**.
- The Hono server applies **x402 Payment Middleware** to a route that serves a **Protected Markdown Resource**.
- The example server exposes a **Protected Route Surface** only; facilitator verify and settle operations stay internal to middleware.
- **x402 Payment Middleware** is implemented as **Reusable Payment Middleware** and demonstrated with a fixed **Protected Markdown Resource** route.
- The **Protected Markdown Resource** is served from a **Protected Markdown File**.
- The v1 protected route uses **Fixed Route Payment Terms**.
- Payment requirements bind to an **Absolute Resource URL**.
- **Payment Subintent Construction** uses **Structured Payment Requirements** rather than server-provided RTM.
- The normal path for **Payment Subintent Construction** is **Payer Manifest Construction** through generic `rdx subintent` commands.
- The **x402 Reference Implementation** uses **Unit-First Payment Coverage** before any live Mainnet path.
- An **Advisory Payment Manifest Template** may accompany **Structured Payment Requirements**, but the agent must rebuild or verify it from the structured fields before signing.
- An **Advisory Preview Root Manifest Template** may accompany **Structured Payment Requirements**, but it is only used for best-effort agent preview.
- The **Authoritative Payment Payload** contains only the signed partial transaction; subintent hash, payer account, expiry, and settlement status are derived by the facilitator.
- The facilitator uses **Signed Partial Transaction Inspection** to derive payer account, asset, amount, Subintent hash, and expiry from the signed payload.
- `@radix-effects/tx-tool` should expose a helper for **Signed Partial Transaction Inspection** so the x402 facilitator does not hand-roll signed partial transaction decoding.
- The facilitator performs **Server Payment Validation** before submitting the sponsored root transaction.
- **Server Payment Validation** requires the **Exact Payment Subintent Shape**.
- The server accepts any **Valid Payer**; payer identity is derived and logged, not allowlisted.
- **x402 Payment Middleware** performs **Validated Subintent Settlement** before treating a payment retry as paid.
- The **Payment Release Boundary** is Gateway `CommittedSuccess`; `Submitted` is not enough to serve the protected resource.
- The **x402 Reference Implementation** keeps **Settlement Records** in memory so a retry after `CommittedSuccess` can serve the protected resource without resubmitting the same signed Subintent.
- Each **Settlement Record** is indexed by a **Settlement Cache Key**.
- The **Settlement Cache Key** uses a **Payment Requirements Hash** rather than hashing the full `402` response object.
- An **x402 Sponsored Payment** uses **Facilitator Notary Binding** so the payer Subintent can `VERIFY_PARENT` against the facilitator's virtual signature badge.
- The **Facilitator Notary Key**, **Fee Payer Account**, and **Pay-To Account** are separate configured roles in the **x402 Reference Implementation**.
- The **Reference Network** for the **x402 Reference Implementation** is Mainnet.
- The **x402 Reference Implementation** ships a **Mainnet Config Template** and applies **Placeholder Rejection** at runtime.
- The payer uses the **Payer rdx Workflow** to create and sign the payment Subintent.
- The payer uses generic `rdx subintent` commands followed by **Signed Subintent Build**; it does not create, notarize, or submit the facilitator root transaction.
- The payer owns the **Payer Account** and uses it when building the payment Subintent.
- The payer performs **Payer Payment Signing** and returns the signature through the rdx signature-file boundary.
- Key sourcing for **Payer Payment Signing** is internal to the CLI-facing payer environment and out of scope for the x402 reference design.
- The agent-side preview may supply an **x402 Preview Root Manifest** as the generic `rdx subintent prepare --root-manifest` file.
- The payer treats Subintent preview as best-effort when it has a suitable **x402 Preview Root Manifest**.
- The payer follows **Preview Root Fallback** before using no-preview.

## Example Dialogue

> **Dev:** "Should the payer build and submit a complete transaction?"
> **Domain expert:** "No — the reference path is an **x402 Sponsored Payment**, so the payer signs a payment **Subintent** and the facilitator submits the root transaction."

> **Dev:** "Can the x402 example be a design note without runnable code?"
> **Domain expert:** "No — the **x402 Reference Implementation** must be executable so the payment flow and settlement boundary are testable."

> **Dev:** "Should the example include an x402-specific client agent?"
> **Domain expert:** "No — keep the payer side as the generic **Payer rdx Workflow**."

> **Dev:** "Should payment handling live directly inside the markdown route handler?"
> **Domain expert:** "No — protect the route with **x402 Payment Middleware** and keep the handler focused on serving the **Protected Markdown Resource**."

> **Dev:** "Should the runnable server expose separate `/verify` and `/settle` endpoints?"
> **Domain expert:** "No — expose only the **Protected Route Surface** and keep facilitator operations internal."

> **Dev:** "Should payment protection be hard-coded into one markdown route?"
> **Domain expert:** "No — implement **Reusable Payment Middleware** and demonstrate it on a single **Protected Markdown Resource** route."

> **Dev:** "Should the protected markdown be generated inline by the route?"
> **Domain expert:** "No — serve it from a **Protected Markdown File**."

> **Dev:** "Should payment requirements be dynamically computed per request?"
> **Domain expert:** "No — use **Fixed Route Payment Terms** for the v1 reference."

> **Dev:** "Can payment requirements bind to a route-relative resource path?"
> **Domain expert:** "No — bind payment to the **Absolute Resource URL** requested by the payer."

> **Dev:** "Should the server send a Subintent manifest template for the payer to sign?"
> **Domain expert:** "No — the payer performs **Payment Subintent Construction** from **Structured Payment Requirements** so it does not sign arbitrary server-authored RTM."

> **Dev:** "Should the payer generate both payment and preview manifests from the structured requirements?"
> **Domain expert:** "Yes — use **Payer Manifest Construction** as the normal path."

> **Dev:** "Can the x402 reference rely on live Mainnet runs for confidence?"
> **Domain expert:** "No — use **Unit-First Payment Coverage** and keep live Mainnet execution explicitly configured."

> **Dev:** "Can the server include a placeholder manifest template anyway?"
> **Domain expert:** "Yes, as an **Advisory Payment Manifest Template**, but it is never the authority the payer signs."

> **Dev:** "Can the server include a root manifest template for agent-side preview?"
> **Domain expert:** "Yes, as an **Advisory Preview Root Manifest Template**, but it is not the canonical settlement transaction."

> **Dev:** "Should the x402 retry payload include payer account and expiry metadata?"
> **Domain expert:** "No — keep the signed partial transaction as the **Authoritative Payment Payload** and derive metadata during validation."

> **Dev:** "Should the x402 example decode signed partial transactions directly?"
> **Domain expert:** "No — add a `@radix-effects/tx-tool` helper for **Signed Partial Transaction Inspection** and use that from the facilitator."

> **Dev:** "Can the server accept a signed payment payload after only checking its JSON shape?"
> **Domain expert:** "No — perform **Server Payment Validation** with static checks and Gateway preview before submission."

> **Dev:** "Can v1 validation accept semantically equivalent payment Subintent manifests?"
> **Domain expert:** "No — require the **Exact Payment Subintent Shape**."

> **Dev:** "Should the server maintain a payer allowlist?"
> **Domain expert:** "No — accept any **Valid Payer**."

> **Dev:** "Can the server accept a valid signed Subintent and settle it later?"
> **Domain expert:** "No — a valid signed Subintent is accepted for **Validated Subintent Settlement**, not as a deferred payment promise."

> **Dev:** "Can the server release markdown after Gateway accepts the transaction submission?"
> **Domain expert:** "No — the **Payment Release Boundary** is `CommittedSuccess`."

> **Dev:** "Should the reference implementation use a production database for settlement records?"
> **Domain expert:** "No — keep **Settlement Records** in memory for the runnable example."

> **Dev:** "Can settlement cache entries be keyed only by Subintent hash?"
> **Domain expert:** "No — use a **Settlement Cache Key** derived from Subintent hash, payment requirements hash, and protected resource URL."

> **Dev:** "Should payment requirements be hashed from the full JSON response?"
> **Domain expert:** "No — compute the **Payment Requirements Hash** from normalized payment semantics and exclude advisory fields."

> **Dev:** "Can the facilitator use any notary when settling a signed payment Subintent?"
> **Domain expert:** "No — **Facilitator Notary Binding** ties the requirements badge, Subintent `VERIFY_PARENT`, and root transaction notary together."

> **Dev:** "Can the facilitator notary, fee payer, and merchant recipient be modeled as one account?"
> **Domain expert:** "No — keep the **Facilitator Notary Key**, **Fee Payer Account**, and **Pay-To Account** as separate roles even if one operator controls them."

> **Dev:** "Should the runnable x402 reference default to Stokenet?"
> **Domain expert:** "No — the **Reference Network** is Mainnet."

> **Dev:** "Can the Mainnet example run with generated defaults?"
> **Domain expert:** "No — provide a **Mainnet Config Template** and enforce **Placeholder Rejection** before payment handling."

> **Dev:** "Should the x402 reference implement its own client agent?"
> **Domain expert:** "No — the payer side is the generic **Payer rdx Workflow**."

> **Dev:** "Should rdx create and submit a full transaction for x402?"
> **Domain expert:** "No — the payer uses generic `rdx subintent` commands and **Signed Subintent Build**; the server settles the root transaction."

> **Dev:** "Should the server or an interactive wallet sign the x402 payment Subintent?"
> **Domain expert:** "No — the payer performs **Payer Payment Signing**; key sourcing is internal to the CLI-facing payer environment."

> **Dev:** "Should the server tell the payer which payer account to use?"
> **Domain expert:** "No — the payer owns the **Payer Account**."

> **Dev:** "Can the payer preview the payment Subintent by itself?"
> **Domain expert:** "No — use an **x402 Preview Root Manifest** when available so preview executes the Subintent in a realistic sponsored root context."

> **Dev:** "Can the payer use `rdx subintent prepare --no-preview`?"
> **Domain expert:** "Yes, but only explicitly; the payer should use an **x402 Preview Root Manifest** when it has enough root context."

> **Dev:** "Should the payer skip preview when no advisory root template is provided?"
> **Domain expert:** "No — follow **Preview Root Fallback** and use no-preview only as the last case."
