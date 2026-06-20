import { homedir } from 'node:os';
import { dirname, join, parse, resolve } from 'node:path';

import { Context, Data, Effect, Layer, Schema } from 'effect';

import { fileExists, readJsonFile } from './platformIo';
import {
  type ArtifactScope,
  ArtifactScopeSchema,
  type Network,
  NetworkSchema,
  PublicKeySchema,
} from './schemas';

export type { ArtifactScope, Network };

const RdxConfigNotarySchema = Schema.Struct({
  publicKey: PublicKeySchema,
  notaryIsSignatory: Schema.optional(Schema.Boolean),
});

export const RdxConfigFileSchema = Schema.Struct({
  network: Schema.optional(NetworkSchema),
  gatewayBaseUrl: Schema.optional(Schema.String),
  artifactScope: Schema.optional(ArtifactScopeSchema),
  artifactDirectory: Schema.optional(Schema.String),
  notary: Schema.optional(RdxConfigNotarySchema),
});

export type RdxConfigFile = typeof RdxConfigFileSchema.Type;

export const ResolvedRdxConfigSchema = Schema.Struct({
  network: NetworkSchema,
  gatewayBaseUrl: Schema.optional(Schema.String),
  artifactScope: ArtifactScopeSchema,
  artifactDirectory: Schema.optional(Schema.String),
  artifactRoot: Schema.String,
  notary: Schema.optional(RdxConfigNotarySchema),
  projectConfigPath: Schema.optional(Schema.String),
  globalConfigPath: Schema.optional(Schema.String),
});

export type ResolvedRdxConfig = typeof ResolvedRdxConfigSchema.Type;

export class ConfigResolutionError extends Data.TaggedError(
  'ConfigResolutionError',
)<{
  path: string;
  reason: unknown;
}> {}

const defaultConfig = {
  network: NetworkSchema.make('mainnet'),
  artifactScope: ArtifactScopeSchema.make('local'),
} satisfies Pick<ResolvedRdxConfig, 'network' | 'artifactScope'>;

const findNearestProjectConfig = (
  cwd: string,
): Effect.Effect<string | undefined> =>
  Effect.gen(function* () {
    let directory = resolve(cwd);
    const root = parse(directory).root;

    while (true) {
      const candidate = join(directory, '.rdxconfig.json');
      if (yield* fileExists(candidate)) {
        return candidate;
      }

      if (directory === root) {
        return undefined;
      }

      directory = dirname(directory);
    }
  });

const readConfigFile = (path: string) =>
  readJsonFile(
    path,
    (reason) => new ConfigResolutionError({ path, reason }),
  ).pipe(
    Effect.flatMap((value) =>
      Schema.decodeUnknownEffect(RdxConfigFileSchema)(value).pipe(
        Effect.mapError(
          (reason) => new ConfigResolutionError({ path, reason }),
        ),
      ),
    ),
  );

const maybeReadConfigFile = (path: string | undefined) =>
  path === undefined
    ? Effect.succeed(undefined)
    : readConfigFile(path).pipe(
        Effect.map((config) => [path, config] as const),
      );

const resolveArtifactRoot = (input: {
  cwd: string;
  home: string;
  config: Pick<ResolvedRdxConfig, 'artifactScope' | 'artifactDirectory'>;
}) => {
  if (input.config.artifactDirectory) {
    return resolve(input.cwd, input.config.artifactDirectory);
  }

  if (input.config.artifactScope === 'global') {
    return join(input.home, '.rdx', 'transactions');
  }

  return join(input.cwd, '.rdx', 'transactions');
};

export const resolveRdxConfig = (input: {
  cwd: string;
  home?: string;
  overrides?: RdxConfigFile;
}): Effect.Effect<ResolvedRdxConfig, ConfigResolutionError> =>
  Effect.gen(function* () {
    const home = input.home ?? homedir();
    const projectConfigPath = yield* findNearestProjectConfig(input.cwd);
    const globalConfigPath = join(home, '.rdx', 'config.json');

    const [globalConfig, projectConfig] = yield* Effect.all([
      fileExists(globalConfigPath).pipe(
        Effect.flatMap((exists) =>
          exists
            ? maybeReadConfigFile(globalConfigPath)
            : Effect.succeed(undefined),
        ),
      ),
      maybeReadConfigFile(projectConfigPath),
    ]);

    const config = {
      ...defaultConfig,
      ...globalConfig?.[1],
      ...projectConfig?.[1],
      ...input.overrides,
    };

    return {
      ...config,
      artifactRoot: resolveArtifactRoot({
        cwd: input.cwd,
        home,
        config,
      }),
      projectConfigPath: projectConfig?.[0],
      globalConfigPath: globalConfig?.[0],
    };
  });

export class ConfigResolver extends Context.Service<ConfigResolver>()(
  'ConfigResolver',
  {
    make: Effect.succeed({
      resolve: resolveRdxConfig,
    }),
  },
) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies;
}
