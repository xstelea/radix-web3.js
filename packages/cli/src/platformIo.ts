import { NodeFileSystem } from '@effect/platform-node';
import { Effect, FileSystem, Schema } from 'effect';

import { renderJson } from './json';

type FileErrorMapper<E> = (reason: unknown) => E;
type MakeDirectoryOptions = Parameters<
  FileSystem.FileSystem['makeDirectory']
>[1];

const withNodeFileSystem = <A, E>(
  effect: Effect.Effect<A, E, FileSystem.FileSystem>,
) => effect.pipe(Effect.provide(NodeFileSystem.layer));

export const fileExists = (path: string): Effect.Effect<boolean> =>
  withNodeFileSystem(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.exists(path);
    }).pipe(Effect.catch(() => Effect.succeed(false))),
  );

export const makeDirectory = <E>(
  path: string,
  options: MakeDirectoryOptions | undefined,
  mapError: FileErrorMapper<E>,
): Effect.Effect<void, E> =>
  withNodeFileSystem(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.makeDirectory(path, options);
    }).pipe(Effect.mapError(mapError)),
  );

export const readDirectory = <E>(
  path: string,
  mapError: FileErrorMapper<E>,
): Effect.Effect<string[], E> =>
  withNodeFileSystem(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.readDirectory(path);
    }).pipe(Effect.mapError(mapError)),
  );

export const isDirectory = <E>(
  path: string,
  mapError: FileErrorMapper<E>,
): Effect.Effect<boolean, E> =>
  withNodeFileSystem(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const info = yield* fs.stat(path);
      return info.type === 'Directory';
    }).pipe(Effect.mapError(mapError)),
  );

export const readFileString = <E>(
  path: string,
  mapError: FileErrorMapper<E>,
): Effect.Effect<string, E> =>
  withNodeFileSystem(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.readFileString(path, 'utf8');
    }).pipe(Effect.mapError(mapError)),
  );

export const writeFileString = <E>(
  path: string,
  data: string,
  mapError: FileErrorMapper<E>,
): Effect.Effect<void, E> =>
  withNodeFileSystem(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.writeFileString(path, data);
    }).pipe(Effect.mapError(mapError)),
  );

export const readJsonFile = <E>(
  path: string,
  mapError: FileErrorMapper<E>,
): Effect.Effect<unknown, E> =>
  readFileString(path, mapError).pipe(
    Effect.flatMap((content) =>
      Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Json))(
        content,
      ).pipe(Effect.mapError(mapError)),
    ),
  );

export const writeJsonFile = <E>(
  path: string,
  value: unknown,
  mapError: FileErrorMapper<E>,
): Effect.Effect<void, E> =>
  writeFileString(path, `${renderJson(value)}\n`, mapError);
