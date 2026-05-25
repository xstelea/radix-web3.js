# PRD: x402 Radix Reference Implementation

## Problem Statement

Developers need a runnable reference design for x402 payments on Radix that demonstrates the exact sponsored-payment settlement flow end to end. The current repo has the transaction tooling primitives, but it does not yet provide a cohesive example where a payer signs a Subintent with generic `rdx subintent` commands and a server-side facilitator validates, sponsors, submits, and waits for settlement before serving protected content.

The reference must clarify the boundary between agent-owned payment signing and server-owned settlement. It must avoid teaching agents to sign arbitrary server-authored RTM, avoid exposing public facilitator endpoints, and avoid accepting optimistic payment states such as submission without committed success.

## Solution

Build a single runnable x402 example package that contains a Hono server, reusable x402 Payment Middleware, local markdown content, and shared payment helpers. The protected route serves a local markdown file only after the middleware has either observed a matching settled payment in memory or accepted a signed partial transaction, validated the payment Subintent, wrapped it in a sponsored root transaction, previewed it, submitted it, and observed Gateway `CommittedSuccess`.

Extend the generic `rdx` CLI with Subintent commands so a payer can prepare and build a signed partial transaction without any x402-specific client agent. Extend tx-tool with a Signed Partial Transaction Inspection helper so the facilitator can derive payer details and Subintent identity from the signed payload instead of trusting HTTP metadata.

The example targets Mainnet through an explicit config template with placeholders. Runtime code must reject placeholders before issuing payment requirements or settling payments.

## User Stories

1. As a developer, I want a runnable x402 Reference Implementation, so that I can see the full Radix payment flow rather than infer it from protocol notes.
2. As a developer, I want the reference to live in one x402 Example Package, so that I can run the agent and server without coordinating multiple workspace packages.
3. As a server integrator, I want a reusable x402 Payment Middleware, so that route handlers can remain focused on serving protected resources.
4. As a server integrator, I want the middleware demonstrated on a Protected Markdown Resource, so that the example has a concrete protected HTTP resource.
5. As a server integrator, I want the server to expose only the Protected Route Surface, so that verify and settle operations are not copied as public APIs.
6. As a server integrator, I want the protected route to use Fixed Route Payment Terms, so that the v1 example stays deterministic and easy to audit.
7. As a server integrator, I want the payment requirements to bind to an Absolute Resource URL, so that payment identity is not ambiguous across hosts or paths.
8. As a server integrator, I want Placeholder Rejection for Mainnet config values, so that the runnable example never silently uses fake production settings.
9. As a server integrator, I want distinct Fee Payer Account, Pay-To Account, and Facilitator Notary Key roles, so that sponsored settlement responsibilities are explicit.
10. As a payer agent, I want to receive Structured Payment Requirements in the `402` response, so that I can construct the payment Subintent without trusting arbitrary server RTM.
11. As a payer agent, I want optional advisory payment and preview templates, so that I can debug the expected shape while still treating structured terms as canonical.
12. As a payer agent, I want to build the payment Subintent locally, so that payer intent is derived from transparent payment terms.
13. As a payer, I want to use generic `rdx subintent` commands, so that x402 payment signing is not tied to an example-specific agent implementation.
14. As a payer agent, I want `rdx subintent prepare` to compute the Subintent hash, so that I know exactly what is being signed.
15. As a payer agent, I want `rdx subintent prepare` to accept a Subintent header file, so that header settings and optional message settings are explicit.
16. As a payer agent, I want `rdx subintent prepare` to support a root manifest preview file, so that I can run a signer-safety preview before signing when enough context is available.
17. As a payer agent, I want `rdx subintent prepare` to require the root manifest placeholder exactly once, so that preview binds to the actual Subintent hash.
18. As a payer agent, I want `rdx subintent prepare` to perform static analysis, so that obvious payment-shape or authorization problems fail before signing.
19. As a payer agent, I want `rdx subintent prepare` to perform best-effort preview when a root manifest is available, so that I can catch runtime failures before producing a payment payload.
20. As a payer agent, I want `rdx subintent prepare` to support an explicit no-preview last resort, so that constrained environments can still produce a Subintent with visible risk.
21. As a payer agent, I want durable prepared Subintent artifacts, so that the signing step is reproducible and inspectable.
22. As a payer agent, I want `rdx subintent build` to combine a prepared Subintent and signature, so that I can produce the signed partial transaction sent to the server.
23. As a payer agent, I want the x402 retry payload to contain the signed partial transaction as the Authoritative Payment Payload, so that no redundant payer metadata needs to be trusted.
24. As a facilitator, I want to inspect signed partial transactions through tx-tool, so that payer account, asset, amount, expiry, and Subintent hash are derived from signed data.
25. As a facilitator, I want to accept any Valid Payer, so that the reference demonstrates open x402 payment instead of an allowlist.
26. As a facilitator, I want to validate the Exact Payment Subintent Shape, so that semantically different or malicious manifests are rejected.
27. As a facilitator, I want to statically validate the signed payment Subintent, so that invalid payloads fail before a sponsored transaction is built.
28. As a facilitator, I want to build the sponsored root transaction internally, so that fee payment and settlement stay server-owned.
29. As a facilitator, I want to preview the sponsored root transaction through Gateway before submission, so that settlement failures are caught before spending fees where possible.
30. As a facilitator, I want to submit only after validation and preview, so that the server does not sponsor arbitrary signed Subintents.
31. As a facilitator, I want to poll until Gateway `CommittedSuccess`, so that the protected resource is served only after the ledger confirms payment.
32. As a facilitator, I want `Submitted` to be insufficient for access, so that users cannot receive content on a merely pending payment.
33. As a facilitator, I want in-memory Settlement Records, so that repeated requests after settlement can serve the resource without resubmitting the same payment.
34. As a facilitator, I want Settlement Cache Key identity to combine Subintent hash, Payment Requirements Hash, and resource URL, so that cache hits are scoped to the exact paid resource and terms.
35. As a developer, I want the Payment Requirements Hash to exclude advisory fields, so that debug templates do not change settlement identity.
36. As a developer, I want Mainnet to be the Reference Network, so that the reference matches the intended production environment.
37. As a developer, I want live Mainnet behavior to be explicitly configured, so that unit and integration tests can run without accidental live payment execution.
38. As a maintainer, I want generic Subintent CLI support rather than x402-specific CLI commands, so that future Subintent use cases can reuse the same command surface.
39. As a maintainer, I want tx-tool to own signed partial transaction inspection, so that examples do not duplicate low-level transaction decoding.
40. As a maintainer, I want unit-first coverage for payment semantics, so that correctness does not depend on live ledger availability.
41. As a maintainer, I want a live-network smoke path behind explicit config, so that the reference can prove real settlement when credentials are intentionally provided.
42. As an AI coding agent, I want the PRD and domain language to distinguish advisory templates from canonical payment requirements, so that implementation does not accidentally make server RTM authoritative.
43. As an AI coding agent, I want the PRD to name the payment release boundary, so that generated code does not serve protected content after submission alone.
44. As an AI coding agent, I want the PRD to define the root manifest preview as signer-safety context, so that it is not treated as the server's canonical settlement transaction.

## Implementation Decisions

- Build one x402 Example Package containing the Hono server, protected markdown file, payment middleware, and shared x402 helpers.
- Use Hono for the backend server and implement x402 Payment Middleware as the server integration point.
- Protect a local markdown resource. The route handler reads the Protected Markdown File only after middleware marks the request as paid.
- Keep the public server surface to the protected resource route. Facilitator verify and settle behavior is internal to middleware.
- Use Fixed Route Payment Terms for the v1 reference.
- Use Mainnet as the Reference Network. Ship a Mainnet Config Template with placeholders for network role configuration and payment terms.
- Apply Placeholder Rejection before issuing payment requirements or attempting settlement.
- Model sponsored payment roles separately: Fee Payer Account locks fees, Pay-To Account receives payment, and Facilitator Notary Key notarizes the sponsored root transaction.
- Return Structured Payment Requirements in the initial `402` response. These are the canonical authority for payment construction.
- Include Advisory Payment Manifest Template and Advisory Preview Root Manifest Template only as optional debug and preview aids.
- Make the signed partial transaction the Authoritative Payment Payload in the x402 retry request.
- Do not trust payer account, amount, asset, expiry, or Subintent hash from HTTP metadata. Derive them from Signed Partial Transaction Inspection.
- Add a tx-tool helper for Signed Partial Transaction Inspection. The helper should decode the signed partial transaction, expose the Subintent manifest and header, compute the Subintent hash, expose signature and public-key details needed for validation, and derive payment-relevant account details.
- Add generic `rdx subintent prepare` support. It accepts a Subintent manifest, a Subintent header file, and either a root manifest preview file or an explicit no-preview flag.
- Add generic `rdx subintent build` support. It accepts a prepared Subintent artifact and signature file, then writes and reports the signed partial transaction hex.
- Keep `rdx subintent` generic. The x402 reference does not include a separate client agent; payer-side signing happens through the generic CLI workflow.
- Name the preview context `root-manifest`. It is temporary signer-safety context and is not part of the signed Subintent.
- Require the root manifest preview file to contain the Subintent hash placeholder exactly once.
- Support one standalone root Subintent in v1. Nested child Subintents are out of scope.
- Include header settings and optional message settings in the Subintent header file.
- Have `rdx subintent prepare` run static analysis and best-effort preview when a root manifest is supplied.
- Permit no-preview only as an explicit last resort.
- Have the payer generate both the payment Subintent manifest and root manifest preview from Structured Payment Requirements when possible.
- Follow Preview Root Fallback on the agent side: build a root manifest preview from structured requirements, use advisory preview template if needed, and use no-preview only as the last case.
- Validate the Exact Payment Subintent Shape on the server. The v1 server does not accept flexible or equivalent manifest variants.
- Build the sponsored root transaction on the server. The payer never notarizes, submits, or settles the facilitator root transaction.
- Preview the sponsored root transaction server-side through Gateway before submission.
- Submit the sponsored root transaction only after signed payload inspection, exact Subintent validation, static validation, and preview pass.
- Poll Gateway until `CommittedSuccess`. Treat `CommittedSuccess` as the Payment Release Boundary.
- Store Settlement Records in memory for the runnable example.
- Compute Settlement Cache Key from Subintent hash, Payment Requirements Hash, and Absolute Resource URL.
- Compute Payment Requirements Hash from normalized payment semantics, excluding advisory templates and debug fields.
- Accept any Valid Payer whose signed Subintent satisfies requirements, passes server validation, and settles successfully.
- Keep key sourcing for payer signing internal to the CLI-facing payer environment and out of scope for the x402 reference design.

## Testing Decisions

- Prefer unit-first payment coverage. Tests should assert external behavior and payment semantics, not incidental implementation structure.
- Test that payment Subintent manifest generation produces the exact v1 instruction sequence required by the server.
- Test that root manifest preview generation contains the Subintent hash placeholder exactly once before prepare-time replacement.
- Test that normalized Payment Requirements Hash ignores advisory templates and debug fields.
- Test that Settlement Cache Key changes when the Subintent hash, Payment Requirements Hash, or Absolute Resource URL changes.
- Test Placeholder Rejection for every required Mainnet config placeholder.
- Test that server validation rejects signed Subintents with the wrong asset, amount, recipient, resource binding, parent check, or instruction order.
- Test that server validation accepts a correctly signed payment Subintent from any payer account.
- Test that middleware returns `402` requirements when no payment payload is present.
- Test that middleware serves the Protected Markdown Resource only after settlement is recorded or `CommittedSuccess` is observed.
- Test that `Submitted` or preview success alone does not serve the protected resource.
- Test that duplicate settled requests hit the in-memory Settlement Record instead of resubmitting.
- Test generic `rdx subintent prepare` behavior for successful prepare, missing root manifest placeholder, duplicate placeholder, static analysis failure, preview failure, and explicit no-preview.
- Test generic `rdx subintent build` behavior for successful signed partial transaction output and invalid signature input.
- Test tx-tool Signed Partial Transaction Inspection against known signed partial transaction fixtures.
- Test generic `rdx subintent` behavior directly; do not add an x402-specific client agent test surface.
- Keep live Mainnet settlement tests behind explicit configuration and skip them by default.
- Use the existing tx-tool V2 transaction tests as prior art for compile, preview, submit, and poll behavior.
- Preserve the existing Stokenet characterization coverage for root and Subintent header mismatch behavior as transaction-tooling evidence, but do not make it the x402 reference network.

## Out of Scope

- Nested child Subintents in the generic Subintent CLI.
- Dynamic route pricing or request-dependent payment terms.
- Public facilitator verify or settle endpoints.
- A durable settlement database or protocol-level receipt store.
- Payer allowlists.
- Browser wallet integration.
- Interactive key management UX for the agent signer.
- Non-sponsored x402 transactions where the payer pays network fees.
- Treating server-authored payment RTM as canonical signing authority.
- Serving resources before Gateway `CommittedSuccess`.
- Multiple protected resources with independent dynamic configuration.
- Packaging x402 middleware as a standalone published library.

## Further Notes

- The design intentionally separates signer-safety preview from server settlement. The agent preview root manifest helps the payer understand what the Subintent is expected to do, but the server still builds, previews, submits, and polls the real sponsored root transaction.
- Radix Subintent headers may differ from the root transaction header. Existing tx-tool characterization coverage shows that such mismatches can compile and submit successfully on Stokenet, so the x402 server should validate the payment semantics it relies on rather than assume header equality.
- Notion publication is currently blocked by expired connector authentication. This repo-local PRD should be copied to Notion once the connector is re-authenticated, and the Linear implementation issue should link back to the Notion page.
