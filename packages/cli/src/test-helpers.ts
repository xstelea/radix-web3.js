import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Effect } from 'effect';

export const makeTempDir = (name: string) =>
  Effect.promise(() => mkdtemp(join(tmpdir(), `rdx-${name}-`)));
