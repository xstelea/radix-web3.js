import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { assert, describe, it } from '@effect/vitest';
import { Effect } from 'effect';

import { resolveRdxConfig } from './config';

const makeTempDir = (name: string) =>
  Effect.tryPromise(() => mkdtemp(join(tmpdir(), `rdx-${name}-`)));

const writeJson = (path: string, value: unknown) =>
  Effect.tryPromise(() => writeFile(path, JSON.stringify(value), 'utf8'));

describe('config resolution', () => {
  it.effect('defaults to mainnet and local artifact storage', () =>
    Effect.gen(function* () {
      const cwd = yield* makeTempDir('default');
      const home = yield* makeTempDir('home');

      const config = yield* resolveRdxConfig({ cwd, home });

      assert.strictEqual(config.network, 'mainnet');
      assert.strictEqual(config.artifactScope, 'local');
      assert.strictEqual(
        config.artifactRoot,
        join(cwd, '.rdx', 'transactions'),
      );
    }),
  );

  it.effect('merges global config and nearest project config', () =>
    Effect.gen(function* () {
      const cwd = yield* makeTempDir('project');
      const nested = join(cwd, 'a', 'b');
      const home = yield* makeTempDir('home');
      yield* Effect.tryPromise(() => mkdir(nested, { recursive: true }));
      yield* Effect.tryPromise(() =>
        mkdir(join(home, '.rdx'), { recursive: true }),
      );
      yield* writeJson(join(home, '.rdx', 'config.json'), {
        network: 'stokenet',
        artifactScope: 'global',
      });
      yield* writeJson(join(cwd, '.rdxconfig.json'), {
        network: 'mainnet',
      });

      const config = yield* resolveRdxConfig({ cwd: nested, home });

      assert.strictEqual(config.network, 'mainnet');
      assert.strictEqual(config.artifactScope, 'global');
      assert.strictEqual(
        config.artifactRoot,
        join(home, '.rdx', 'transactions'),
      );
      assert.strictEqual(
        config.projectConfigPath,
        join(cwd, '.rdxconfig.json'),
      );
      assert.strictEqual(
        config.globalConfigPath,
        join(home, '.rdx', 'config.json'),
      );
    }),
  );

  it.effect('uses explicit artifact directories over artifact scope', () =>
    Effect.gen(function* () {
      const cwd = yield* makeTempDir('explicit');
      const home = yield* makeTempDir('home');
      const artifactDirectory = join(cwd, 'artifacts');
      yield* writeJson(join(cwd, '.rdxconfig.json'), {
        artifactScope: 'global',
        artifactDirectory,
      });

      const config = yield* resolveRdxConfig({ cwd, home });

      assert.strictEqual(config.artifactRoot, artifactDirectory);
    }),
  );

  it.effect(
    'fails with the project config path when project config is invalid',
    () =>
      Effect.gen(function* () {
        const cwd = yield* makeTempDir('invalid-project');
        const home = yield* makeTempDir('home');
        const projectConfigPath = join(cwd, '.rdxconfig.json');
        yield* writeJson(projectConfigPath, {
          network: 'invalid-network',
        });

        const result = yield* Effect.result(resolveRdxConfig({ cwd, home }));

        assert.strictEqual(result._tag, 'Failure');
        if (result._tag === 'Failure') {
          assert.strictEqual(result.failure._tag, 'ConfigResolutionError');
          assert.strictEqual(result.failure.path, projectConfigPath);
        }
      }),
  );
});
