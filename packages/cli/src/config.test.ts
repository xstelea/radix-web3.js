import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { it } from '@effect/vitest';
import { Effect } from 'effect';
import { describe, expect } from 'vitest';

import { resolveRdxConfig } from './config';

const makeTempDir = (name: string) =>
  Effect.promise(() => mkdtemp(join(tmpdir(), `rdx-${name}-`)));

const writeJson = (path: string, value: unknown) =>
  Effect.promise(() => writeFile(path, JSON.stringify(value), 'utf8'));

describe('config resolution', () => {
  it.effect('defaults to mainnet and local artifact storage', () =>
    Effect.gen(function* () {
      const cwd = yield* makeTempDir('default');
      const home = yield* makeTempDir('home');

      const config = yield* resolveRdxConfig({ cwd, home });

      expect(config).toMatchObject({
        network: 'mainnet',
        artifactScope: 'local',
        artifactRoot: join(cwd, '.rdx', 'transactions'),
      });
    }),
  );

  it.effect('merges global config and nearest project config', () =>
    Effect.gen(function* () {
      const cwd = yield* makeTempDir('project');
      const nested = join(cwd, 'a', 'b');
      const home = yield* makeTempDir('home');
      yield* Effect.promise(() => mkdir(nested, { recursive: true }));
      yield* Effect.promise(() =>
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

      expect(config).toMatchObject({
        network: 'mainnet',
        artifactScope: 'global',
        artifactRoot: join(home, '.rdx', 'transactions'),
      });
      expect(config.projectConfigPath).toBe(join(cwd, '.rdxconfig.json'));
      expect(config.globalConfigPath).toBe(join(home, '.rdx', 'config.json'));
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

      expect(config.artifactRoot).toBe(artifactDirectory);
    }),
  );
});
