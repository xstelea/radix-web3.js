# CI Automation Guide

## Source Paths

Workflow source paths:

- `./.github/workflows/ci.yml`
- `./.github/workflows/changeset-check.yml`
- `./.github/workflows/release.yml`
- `./.github/workflows/deploy.yml`

Workspace automation paths:

- `./package.json`
- `./pnpm-workspace.yaml`
- `./pnpm-lock.yaml`
- `./turbo.json`
- `./.changeset/config.json`
- `./apps/docs/package.json`
- `./apps/docs/docusaurus.config.ts`

## Mental Model

Automation is a thin layer over repo scripts, not a second build system:

- `ci.yml` protects pushes and pull requests with install, lint, test, and build.
- `changeset-check.yml` protects pull requests by checking release intent against `origin/main`.
- `release.yml` runs Changesets on pushes to `main`, creates version PRs, and publishes to npm when a release is ready.
- `deploy.yml` builds the docs app and publishes `apps/docs/build` to GitHub Pages.

Do not change a workflow in isolation. Every workflow command should be traced back to a root script, package script, Changesets config, Docusaurus config, or workspace dependency setting.

## Examples

Use these examples when changing GitHub Actions workflows, CI commands, release automation, docs deployment, or automation secrets.

### Change the main CI check

Use this when editing pull request or push checks for install, lint, tests, builds, Node version, pnpm cache, or workflow permissions.

Start with:

- `./.github/workflows/ci.yml`
- `./package.json`
- `./turbo.json`
- `./pnpm-lock.yaml`
- `./references/guide-build-release.md`
- `./references/guide-testing.md`

Pattern:

```text
checkout
pnpm setup
setup-node with node-version 22 and pnpm cache
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
```

Rule: CI currently runs lint, test, then build. Root scripts map lint to `oxlint ./packages`, test to `turbo test`, and build to `turbo build`. Keep `--frozen-lockfile` on CI installs unless a lockfile regeneration task is explicit.

Done when: the workflow command still maps to a root script, Node and pnpm setup match the workspace, and the changed validation claim is backed by either local command output or the workflow command list.

### Change pull request Changesets enforcement

Use this when release-intent checks, PR comments, changed publishable packages, or empty changesets are involved.

Start with:

- `./.github/workflows/changeset-check.yml`
- `./.changeset/config.json`
- `./.changeset/README.md`
- `./package.json`
- `./references/guide-build-release.md`

Pattern:

```text
fetch-depth: 0
pnpm changeset status --since=origin/main
write or update a PR comment with a marker
fail when status is not 0
```

Rule: the check intentionally comments before failing. It strips ANSI control characters, truncates long output, and uses the marker `<!-- changeset-check -->` to update the same PR comment. Preserve that marker behavior when changing comment content.

Done when: the PR check still compares against `origin/main`, ignored packages match `.changeset/config.json`, and failure behavior still guides contributors to add a changeset or an empty changeset.

### Change release publishing

Use this when modifying package publishing, version PR behavior, npm authentication, release commits, or Changesets action inputs.

Start with:

- `./.github/workflows/release.yml`
- `./package.json`
- `./.changeset/config.json`
- `./pnpm-workspace.yaml`
- `./references/guide-build-release.md`

Pattern:

```text
push to main
permissions: contents write, pull-requests write
changesets/action@v1
version: pnpm ci:version
publish: pnpm ci:publish --no-git-checks
NPM_TOKEN and NODE_AUTH_TOKEN from secrets.NPM_TOKEN
```

Rule: the release workflow delegates versioning and publishing to root scripts. `ci:version` runs `changeset version`; `ci:publish` runs build then `changeset publish`. Keep npm registry setup and both npm auth environment variables aligned.

Done when: publish behavior is traceable from workflow to root scripts to Changesets config, package ignore rules are understood, and any changed secret or permission is necessary for the release action.

### Change docs deployment

Use this when GitHub Pages deployment, docs build commands, publish directory, Docusaurus base URL, or docs app scripts change.

Start with:

- `./.github/workflows/deploy.yml`
- `./apps/docs/package.json`
- `./apps/docs/docusaurus.config.ts`
- `./apps/docs/sidebars.ts`
- `./references/guide-docs-context.md`
- `./references/guide-build-release.md`

Pattern:

```text
push to main
pnpm --filter docs build
peaceiris/actions-gh-pages@v3
publish_dir: ./apps/docs/build
baseUrl: /radix-web3.js/
```

Rule: docs deployment depends on both workflow paths and Docusaurus config. If `publish_dir`, `baseUrl`, `url`, or `routeBasePath` changes, inspect the docs app config and any GitHub Pages expectations together.

Done when: the workflow builds the same app it deploys, the publish directory matches Docusaurus output, and the configured base URL matches the target GitHub Pages path.

### Change workflow dependency setup

Use this when updating Node versions, pnpm setup, cache behavior, install flags, lockfile handling, or workspace package manager settings.

Start with:

- `./.github/workflows/ci.yml`
- `./.github/workflows/release.yml`
- `./.github/workflows/deploy.yml`
- `./package.json`
- `./pnpm-workspace.yaml`

Pattern:

```text
packageManager: pnpm@11.5.2
engines.node: >=20
workflow node-version: 22
cache: pnpm
CI install: pnpm install --frozen-lockfile
release and deploy install: pnpm install
```

Rule: Node 22 satisfies the root engine and appears across workflows. Do not change one workflow to a different runtime without a reason that also accounts for package engines, lockfile behavior, and pnpm cache configuration.

Done when: every workflow that installs dependencies uses a compatible Node runtime, cache setup is consistent, and lockfile strictness is intentionally different only where the workflow needs it.

### Change workflow permissions and secrets

Use this when editing `permissions`, `GITHUB_TOKEN`, `NPM_TOKEN`, `NODE_AUTH_TOKEN`, Pages deployment token use, or pull request comment permissions.

Start with:

- `./.github/workflows/ci.yml`
- `./.github/workflows/changeset-check.yml`
- `./.github/workflows/release.yml`
- `./.github/workflows/deploy.yml`
- `./references/guide-configuration.md`

Pattern:

```text
CI: contents read
Changeset Check: contents read, pull-requests write, issues write
Release: contents write, pull-requests write, NPM_TOKEN
Deploy: GITHUB_TOKEN for gh-pages publishing
```

Rule: grant permissions to the workflow that needs them, not to every workflow. CI should remain read-only. PR comment workflows need write permission to issues or pull requests. Publishing needs npm secrets and repository write permission.

Done when: each permission or secret has a named consuming step, no read-only check gains publish-level privileges, and secret names match the action or command that consumes them.

## Reference Routes

- Package build, publish scripts, Changesets config, and package metadata: use `guide-build-release.md`.
- Tests, Vitest configuration, generated fixtures, and validation scope: use `guide-testing.md`.
- Docusaurus configuration, MDX docs, docs app scripts, and GitHub Pages pathing: use `guide-docs-context.md`.
- Runtime environment values, secrets, and deployment configuration boundaries: use `guide-configuration.md`.
- CLI behavior changed by CI or release tasks: use `guide-cli.md`.

Routing check: start here for GitHub Actions ownership, then route to build, testing, docs, config, or package guides for the command being run by the workflow.

## Usage Notes

- Keep workflow commands traceable to repo scripts or package scripts.
- Do not broaden workflow permissions unless the consuming step is identified.
- Preserve release separation: Changeset check validates pull requests, release publishes from `main`.
- Preserve docs separation: docs deploy builds the `docs` app and publishes `apps/docs/build`.
- Treat automation edits as release-impacting until CI, Changesets, docs deploy, and secret scopes have been checked.
