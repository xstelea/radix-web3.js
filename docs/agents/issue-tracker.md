# Issue tracker: Linear + Notion

Implementation issues for this repo live in Linear. Long-form documents such as PRDs, design docs, research briefs, and decision writeups live in Notion.

Use the Linear integration when creating, updating, or triaging implementation work. Use the Notion integration when creating or updating long-form project documents.

## Conventions

- Create Linear issues for implementation tasks, QA findings, triage output, and work that needs assignment or status tracking.
- Create Notion pages for PRDs, design docs, architecture notes, research synthesis, and other long-form documents.
- Link Linear issues back to their source Notion document when a PRD or design doc produces implementation work.
- Link Notion documents to their related Linear issues when the document has follow-up work.
- Prefer the repo's triage label mapping from `docs/agents/triage-labels.md` when labeling Linear issues.
- Link Linear work back to this repository when the issue supports repository or PR metadata.

## When a skill says "publish to the issue tracker"

For implementation tasks, create Linear issues.

For PRDs, design docs, and other long-form planning documents, create or update a Notion page, then create Linear follow-up issues only when there is implementation work to track.

## When a skill says "fetch the relevant ticket"

Fetch the Linear issue and include its title, description, comments, labels, status, and linked PRs when relevant.

If the work references a Notion document, fetch the Notion page too and use it as the source of truth for product/design context.
