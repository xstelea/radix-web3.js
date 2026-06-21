# Build And Release Guide

## Source Paths

Workspace source paths:

- `./package.json`
- `./turbo.json`
- `./pnpm-workspace.yaml`
- `./.changeset/config.json`
- `./packages/cli/package.json`
- `./packages/core/package.json`
- `./packages/core/tsup.config.ts`
- `./packages/gateway/package.json`
- `./packages/sbor/package.json`
- `./packages/shared/package.json`
- `./packages/tx-tool/package.json`
- `./packages/connect/tsup.config.ts`
- `./packages/agent-toolkit/tsup.config.ts`
- `./packages/cli/vitest.config.ts`
- `./packages/gateway/vitest.config.ts`
- `./packages/tx-tool/vitest.config.ts`

## Mental Model

`radix-web3.js` is a pnpm workspace with Turbo task orchestration, package-local build tools, and Changesets publishing. Treat build and release behavior as package metadata, not as a generic TypeScript default.

Separate these surfaces:

- root scripts decide repo-wide commands and publish flows
- `turbo.json` decides task dependencies, cache inputs, and outputs
- `pnpm-workspace.yaml` decides workspace membership, catalog versions, build allowances, and overrides
- each package `package.json` decides exports, published files, bin entries, and package-local build tool
- Changesets decides which packages version and publish

Most release bugs come from copying package metadata across packages that build differently. Inspect the package's own `package.json`, build config, and tests before changing exports or release scripts.

## Examples

Use these examples when a task changes package scripts, exports, bins, workspace dependencies, Turbo tasks, build output, or publishing behavior.

### Choose the right workspace command

Use this when deciding whether to run a root command, package command, or Turbo task.

Start with:

- `./package.json`
- `./turbo.json`
- `./pnpm-workspace.yaml`
- `./references/guide-testing.md`

Pattern:

```text
pnpm build runs turbo build
pnpm dev runs turbo dev
pnpm test runs turbo test
pnpm format runs oxfmt --write ./packages
pnpm lint runs oxlint ./packages
pnpm check-types runs format then lint
```

Rule: `turbo build` depends on upstream package builds and writes `dist/**`. `turbo test` depends on upstream builds and upstream tests. Use package-local commands for narrow validation, but use root commands before claiming repo-wide build or release readiness.

Done when: the command choice matches the changed package scope, and the report distinguishes package-local validation from whole-workspace validation.

### Add or change package build output

Use this when modifying `dist` output, declaration files, package entrypoints, or build tooling.

Start with:

- `./packages/core/package.json`
- `./packages/core/tsup.config.ts`
- `./packages/connect/tsup.config.ts`
- `./packages/cli/package.json`
- `./packages/gateway/package.json`
- `./packages/shared/package.json`

Pattern:

```text
core, connect, and agent-toolkit use tsup
cli, gateway, sbor, shared, transaction-stream, and tx-tool use tsdown
tsup packages may publish cjs and esm outputs
tsdown packages in this repo commonly publish mjs and d.mts outputs
```

Rule: do not assume one package's `main`, `module`, `types`, or `exports` shape applies to another package. Check whether the package uses `tsup`, `tsdown`, or a CLI bin build before changing metadata.

Done when: build output, `files`, `main`, `module`, `types`, `exports`, and package-local build command all agree with the package's actual build tool.

### Add a public package export

Use this when adding a new public entrypoint, moving an entrypoint, or exposing a submodule.

Start with:

- `./packages/core/package.json`
- `./packages/core/tsup.config.ts`
- `./packages/core/src/index.ts`
- `./packages/tx-tool/package.json`
- `./packages/tx-tool/src/index.ts`
- `./references/guide-radix-web3-js.md`

Pattern:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.mts",
      "import": "./dist/index.mjs"
    }
  }
}
```

Rule: add public API in the package source barrel and package metadata together. If the package has multiple build entries, verify the generated file name and declaration extension before adding an export path.

Done when: a consumer import path resolves through `exports`, the build produces matching JS and declaration files, and package tests or a smoke import cover the new entrypoint.

### Keep the CLI binary publishable

Use this when changing `rdx` CLI build output, install behavior, bin paths, or package metadata.

Start with:

- `./packages/cli/package.json`
- `./packages/cli/src/bin/rdx.ts`
- `./packages/cli/src/index.ts`
- `./packages/cli/src/cli.ts`
- `./references/guide-cli.md`
- `./references/cli-command-reference.md`

Pattern:

```json
{
  "name": "rdx-cli",
  "bin": {
    "rdx": "./dist/bin/rdx.mjs"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsdown"
  }
}
```

Rule: global installation depends on the package `bin` path and published `files`. Changing CLI source, build output, or package files requires checking `npm install -g rdx-cli` expectations in setup and command-reference docs.

Done when: `rdx` points to a built file included in `files`, CLI tests cover command parsing or output, and docs still identify `rdx-cli` as publishing the `rdx` binary.

### Add or update workspace dependencies

Use this when adding an internal package dependency, upgrading shared external versions, or resolving dependency conflicts.

Start with:

- `./pnpm-workspace.yaml`
- `./packages/gateway/package.json`
- `./packages/tx-tool/package.json`
- `./packages/agent-toolkit/package.json`
- `./packages/sbor/package.json`

Pattern:

```json
{
  "dependencies": {
    "@radix-effects/shared": "workspace:*",
    "effect": "catalog:"
  }
}
```

Rule: use `workspace:*` for internal package links and `catalog:` for shared external versions already defined in `pnpm-workspace.yaml`. Update the catalog or overrides intentionally; do not pin a second version in one package without checking why the workspace centralizes it.

Done when: the dependency kind matches internal or external ownership, catalog updates are reflected in one place, and the package's build and tests run with the new dependency graph.

### Prepare a Changesets release

Use this when versioning, changelog output, publish scripts, ignored packages, or internal dependency bump behavior changes.

Start with:

- `./package.json`
- `./.changeset/config.json`
- `./packages/core/CHANGELOG.md`
- `./packages/gateway/CHANGELOG.md`
- `./packages/cli/CHANGELOG.md`

Pattern:

```text
pnpm run publish-packages runs turbo run build, changeset version, then changeset publish
pnpm run ci:version runs changeset version
pnpm run ci:publish runs pnpm run build, then changeset publish
Changesets access is public
Changesets baseBranch is main
updateInternalDependencies is patch
ignored packages are docs and @radix-effects/x402-example
```

Rule: Changesets owns versions and changelogs for published packages. Do not manually edit package versions or changelog sections unless the release process explicitly calls for it.

Done when: the intended packages are included or ignored by Changesets, internal dependency bump behavior is understood, root build passes before publish, and generated version/changelog changes are reviewed as release artifacts.

### Adjust package test and typecheck behavior

Use this when package-local tests, type checks, Vitest runtime behavior, or CI command behavior changes.

Start with:

- `./turbo.json`
- `./packages/cli/package.json`
- `./packages/cli/vitest.config.ts`
- `./packages/gateway/vitest.config.ts`
- `./packages/tx-tool/vitest.config.ts`
- `./references/guide-testing.md`

Pattern:

```text
cli tests include src/**/*.test.ts
gateway tests run in node with globals, forks, maxWorkers 1, and isolate false
tx-tool tests run in node with globals
some packages expose check-types through tsc --noEmit
root check-types currently runs format and lint
```

Rule: package test runtime is part of the package contract. Do not make a shared Vitest assumption across packages without checking local `vitest.config.ts`.

Done when: the changed package's local test command still matches its config, root `turbo test` dependency behavior is accounted for, and typecheck or lint claims cite the actual script that was run.

## Reference Routes

- Workspace commands and publish scripts: inspect root `package.json`.
- Turbo build and test dependencies: inspect `turbo.json`.
- Workspace membership, catalogs, and overrides: inspect `pnpm-workspace.yaml`.
- Package exports and bins: inspect the package's own `package.json`.
- tsup package output: inspect package-local `tsup.config.ts`.
- Changesets release behavior: inspect `.changeset/config.json` and package changelogs.

Routing check: adjacent routing sends package implementation details to the matching package guide, test strategy to `guide-testing.md`, and config/env behavior to `guide-configuration.md`.

## Usage Notes

- Treat package metadata as source. Do not infer publish shape from TypeScript source alone.
- Verify `files` before claiming an artifact is published.
- Prefer package-local validation during edits and root Turbo validation before repo-wide or release claims.
- Keep generated `dist` output out of skill edits unless the user explicitly asks to inspect build artifacts.
- Check Changesets ignore rules before expecting docs or examples to version or publish.
