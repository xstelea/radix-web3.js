import { Effect, Schema } from 'effect';
import {
  deriveVirtualAccountAddress,
  gatewayAccountBalance,
  gatewayAccountDetails,
  gatewayAccountHistory,
  getAccountBalance,
  getAccountDetails,
  getAccountTransactionHistory,
} from './accountReads';
import { addSignaturesToArtifact } from './addSignatures';
import { findTransactionArtifact, listTransactionArtifacts } from './artifacts';
import {
  type OutputFormat,
  renderAccountDerive,
  renderAddSignatures,
  renderCommandResult,
  renderConfigShow,
  renderLlmGuide,
  renderNotarize,
  renderPrepare,
  renderSubmit,
  renderTemplate,
  renderTxList,
  renderTxPath,
  renderTxStatus,
} from './cli';
import { resolveRdxConfig } from './config';
import { notarizeTransactionArtifact } from './notarize';
import { readJsonFile } from './platformIo';
import { prepareTransactionArtifacts } from './prepare';
import {
  type ArtifactStatus,
  NotaryFileSchema,
  type PreparedTransaction,
} from './schemas';
import {
  gatewayTransactionStatus,
  listTransactionArtifactsWithNetworkStatus,
  queryTransactionStatus,
} from './status';
import {
  gatewaySubmitNotarizedTransaction,
  submitTransactionArtifact,
} from './submit';
import type { TemplateKind } from './templates';

export type { OutputFormat };
export * from './accountReads';
export * from './artifacts';
export * from './addSignatures';
export * from './config';
export * from './llm';
export * from './notarize';
export * from './prepare';
export * from './schemas';
export * from './signatureImport';
export * from './signingRequests';
export * from './status';
export * from './submit';
export * from './subintentAssembly';
export * from './templates';

export type RdxResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type RunRdxInput = {
  argv: string[];
  cwd: string;
};

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const structuredError = (input: {
  code: string;
  message: string;
  exitCode: number;
}): RdxResult => ({
  exitCode: input.exitCode,
  stdout: '',
  stderr: json({
    type: 'error',
    code: input.code,
    message: input.message,
  }),
});

const parseGlobalFlags = (argv: string[]) => {
  let format: OutputFormat = 'json';
  const rest: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--format') {
      const value = argv[index + 1];
      if (value === 'json' || value === 'text') {
        format = value;
        index += 1;
        continue;
      }
    }

    rest.push(arg);
  }

  return { format, argv: rest };
};

const takeOption = (argv: string[], name: string) => {
  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
};

const takeRepeatedOption = (argv: string[], name: string) => {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === name && argv[index + 1]) {
      values.push(argv[index + 1]);
      index += 1;
    }
  }
  return values;
};

export const runRdxEffect = (input: RunRdxInput): Effect.Effect<RdxResult> =>
  Effect.gen(function* () {
    const { format, argv } = parseGlobalFlags(input.argv);
    const command = argv.join(' ');

    if (command === 'config show') {
      const config = yield* resolveRdxConfig({ cwd: input.cwd }).pipe(
        Effect.mapError((error) => error),
      );
      return {
        exitCode: 0,
        stdout: `${renderConfigShow(format, config)}\n`,
        stderr: '',
      };
    }

    if (command === 'llm') {
      return {
        exitCode: 0,
        stdout: `${renderLlmGuide()}\n`,
        stderr: '',
      };
    }

    if (argv[0] === 'account' && argv[1] === 'balance' && argv[2]) {
      const config = yield* resolveRdxConfig({ cwd: input.cwd });
      const result = yield* getAccountBalance({
        accountAddress: argv[2],
        readBalance: (accountAddress) =>
          gatewayAccountBalance({ config, accountAddress }),
      });
      return {
        exitCode: 0,
        stdout: `${renderCommandResult(format, result)}\n`,
        stderr: '',
      };
    }

    if (argv[0] === 'account' && argv[1] === 'derive') {
      const publicKeyHex = takeOption(argv, '--public-key');
      if (!publicKeyHex) {
        return structuredError({
          code: 'MISSING_ARGUMENT',
          message: 'account derive requires --public-key',
          exitCode: 64,
        });
      }
      const config = yield* resolveRdxConfig({ cwd: input.cwd });
      const result = yield* deriveVirtualAccountAddress({
        network: config.network,
        publicKeyHex,
      });
      return {
        exitCode: 0,
        stdout: `${renderAccountDerive(format, result)}\n`,
        stderr: '',
      };
    }

    if (argv[0] === 'account' && argv[1] === 'show' && argv[2]) {
      const config = yield* resolveRdxConfig({ cwd: input.cwd });
      const result = yield* getAccountDetails({
        accountAddress: argv[2],
        readDetails: (accountAddress) =>
          gatewayAccountDetails({ config, accountAddress }),
      });
      return {
        exitCode: 0,
        stdout: `${renderCommandResult(format, result)}\n`,
        stderr: '',
      };
    }

    if (argv[0] === 'tx' && argv[1] === 'path' && argv[2]) {
      const config = yield* resolveRdxConfig({ cwd: input.cwd });
      const artifactPath = yield* findTransactionArtifact({
        artifactRoot: config.artifactRoot,
        transactionId: argv[2],
      });
      return {
        exitCode: 0,
        stdout: `${renderTxPath(format, {
          transactionId: argv[2],
          artifactPath,
        })}\n`,
        stderr: '',
      };
    }

    if (argv[0] === 'tx' && argv[1] === 'prepare') {
      const manifestPath = takeOption(argv, '--manifest');
      const notaryFilePath = takeOption(argv, '--notary-file');
      const subintentsPath = takeOption(argv, '--subintents');
      if (!manifestPath) {
        return structuredError({
          code: 'MISSING_ARGUMENT',
          message: 'tx prepare requires --manifest',
          exitCode: 64,
        });
      }

      const config = yield* resolveRdxConfig({ cwd: input.cwd });
      const notary = notaryFilePath
        ? yield* readJsonFile(notaryFilePath, (reason) => reason).pipe(
            Effect.flatMap(Schema.decodeUnknown(NotaryFileSchema)),
          )
        : config.notary;
      if (!notary) {
        return structuredError({
          code: 'MISSING_ARGUMENT',
          message:
            'tx prepare requires --notary-file or config notary settings',
          exitCode: 64,
        });
      }
      const result = yield* prepareTransactionArtifacts({
        artifactRoot: config.artifactRoot,
        network: config.network,
        manifestPath,
        subintentsPath,
        notary,
        previewPreparedTransaction: () => Effect.void,
      });

      return {
        exitCode: 0,
        stdout: `${renderPrepare(format, result)}\n`,
        stderr: '',
      };
    }

    if (argv[0] === 'tx' && argv[1] === 'add-signatures' && argv[2]) {
      const config = yield* resolveRdxConfig({ cwd: input.cwd });
      const result = yield* addSignaturesToArtifact({
        artifactRoot: config.artifactRoot,
        transactionId: argv[2],
        signatureFilePaths: takeRepeatedOption(argv, '--file'),
      });
      return {
        exitCode: 0,
        stdout: `${renderAddSignatures(format, result)}\n`,
        stderr: '',
      };
    }

    if (argv[0] === 'tx' && argv[1] === 'notarize' && argv[2]) {
      const config = yield* resolveRdxConfig({ cwd: input.cwd });
      const result = yield* notarizeTransactionArtifact({
        artifactRoot: config.artifactRoot,
        transactionId: argv[2],
      });
      return {
        exitCode: 0,
        stdout: `${renderNotarize(format, result)}\n`,
        stderr: '',
      };
    }

    if (argv[0] === 'tx' && argv[1] === 'submit' && argv[2]) {
      const config = yield* resolveRdxConfig({ cwd: input.cwd });
      const result = yield* submitTransactionArtifact({
        artifactRoot: config.artifactRoot,
        transactionId: argv[2],
        submitNotarizedTransaction: (notarizedTransactionHex) =>
          gatewaySubmitNotarizedTransaction({
            config,
            transactionId: argv[2],
            notarizedTransactionHex,
          }),
        pollTransactionStatus: (id) =>
          gatewayTransactionStatus({ config, transactionId: id }),
      });
      return {
        exitCode: 0,
        stdout: `${renderSubmit(format, result)}\n`,
        stderr: '',
      };
    }

    if (argv[0] === 'tx' && argv[1] === 'list') {
      const config = yield* resolveRdxConfig({ cwd: input.cwd });
      const listInput = {
        artifactRoot: config.artifactRoot,
        pattern: takeOption(argv, '--pattern'),
        regex: takeOption(argv, '--regex'),
        network: takeOption(argv, '--network') as
          | PreparedTransaction['network']
          | undefined,
        status: takeOption(argv, '--status') as ArtifactStatus | undefined,
      };
      const withNetworkStatus = argv.includes('--with-network-status');
      const updateNetworkStatus = argv.includes('--update-network-status');
      const artifacts =
        withNetworkStatus || updateNetworkStatus
          ? yield* listTransactionArtifactsWithNetworkStatus({
              ...listInput,
              update: updateNetworkStatus,
              getNetworkStatus: (id) =>
                gatewayTransactionStatus({ config, transactionId: id }),
            })
          : yield* listTransactionArtifacts(listInput);
      return {
        exitCode: 0,
        stdout: `${renderTxList(format, artifacts)}\n`,
        stderr: '',
      };
    }

    if (argv[0] === 'tx' && argv[1] === 'status' && argv[2]) {
      const config = yield* resolveRdxConfig({ cwd: input.cwd });
      const result = yield* queryTransactionStatus({
        artifactRoot: config.artifactRoot,
        transactionId: argv[2],
        readOnly: argv.includes('--read-only'),
        getNetworkStatus: (id) =>
          gatewayTransactionStatus({ config, transactionId: id }),
      });
      return {
        exitCode: 0,
        stdout: `${renderTxStatus(format, result)}\n`,
        stderr: '',
      };
    }

    if (argv[0] === 'tx' && argv[1] === 'history' && argv[2]) {
      const config = yield* resolveRdxConfig({ cwd: input.cwd });
      const limit = Number(takeOption(argv, '--limit') ?? 10);
      const result = yield* getAccountTransactionHistory({
        accountAddress: argv[2],
        limit,
        readHistory: (accountAddress, itemLimit) =>
          gatewayAccountHistory({ config, accountAddress, limit: itemLimit }),
      });
      return {
        exitCode: 0,
        stdout: `${renderCommandResult(format, result)}\n`,
        stderr: '',
      };
    }

    if (argv[0] === 'template' && argv[1] === 'print' && argv[2]) {
      return {
        exitCode: 0,
        stdout: `${renderTemplate(argv[2] as TemplateKind)}\n`,
        stderr: '',
      };
    }

    return structuredError({
      code: 'UNKNOWN_COMMAND',
      message: `Unknown command: ${argv[0] ?? ''}`,
      exitCode: 64,
    });
  }).pipe(
    Effect.catchAll((error) => {
      if (
        typeof error === 'object' &&
        error !== null &&
        '_tag' in error &&
        error._tag === 'InvalidPublicKeyError'
      ) {
        return Effect.succeed(
          structuredError({
            code: 'INVALID_PUBLIC_KEY',
            message: 'Expected a 64-character Ed25519 public key hex value',
            exitCode: 64,
          }),
        );
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        '_tag' in error &&
        error._tag === 'ConfigResolutionError' &&
        'path' in error
      ) {
        return Effect.succeed(
          structuredError({
            code: 'CONFIG_RESOLUTION_ERROR',
            message: `Could not read config file: ${error.path}`,
            exitCode: 78,
          }),
        );
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        '_tag' in error &&
        error._tag === 'ArtifactStoreError' &&
        'path' in error
      ) {
        return Effect.succeed(
          structuredError({
            code: 'ARTIFACT_STORE_ERROR',
            message: `Could not read transaction artifact: ${error.path}`,
            exitCode: 66,
          }),
        );
      }

      return Effect.succeed(
        structuredError({
          code: 'COMMAND_ERROR',
          message: 'Command failed',
          exitCode: 1,
        }),
      );
    }),
  );

export const runRdx = async (input: RunRdxInput): Promise<RdxResult> =>
  Effect.runPromise(runRdxEffect(input));
