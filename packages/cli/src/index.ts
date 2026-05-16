import { AccountAddress, TransactionId } from '@radix-effects/shared';
import { Data, Effect, Schema } from 'effect';
import {
  deriveVirtualAccountAddress,
  gatewayAccountDetails,
  gatewayAccountFungibles,
  gatewayAccountHistory,
  gatewayAccountNfts,
  getAccountDetails,
  getAccountFungibles,
  getAccountNfts,
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
  ArtifactStatusSchema,
  NetworkSchema,
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

type ParsedRdxCommand = Data.TaggedEnum<{
  // biome-ignore lint/complexity/noBannedTypes: Effect's taggedEnum uses `{}` for nullary variants.
  ConfigShow: {};
  // biome-ignore lint/complexity/noBannedTypes: Effect's taggedEnum uses `{}` for nullary variants.
  Llm: {};
  AccountFungibles: { accountAddress: AccountAddress };
  AccountNfts: { accountAddress: AccountAddress };
  AccountDerive: { publicKeyHex?: string };
  AccountShow: { accountAddress: AccountAddress };
  TxPath: { transactionId: TransactionId };
  TxPrepare: {
    manifestPath?: string;
    notaryFilePath?: string;
    subintentsPath?: string;
  };
  TxAddSignatures: {
    transactionId: TransactionId;
    signatureFilePaths: string[];
  };
  TxNotarize: { transactionId: TransactionId };
  TxSubmit: { transactionId: TransactionId };
  TxList: {
    pattern?: string;
    regex?: string;
    network?: PreparedTransaction['network'];
    status?: ArtifactStatus;
    withNetworkStatus: boolean;
    updateNetworkStatus: boolean;
  };
  TxStatus: { transactionId: TransactionId; readOnly: boolean };
  TxHistory: { accountAddress: AccountAddress; limit: number };
  TemplatePrint: { kind: TemplateKind };
  Unknown: { command: string };
}>;

const RdxCommand = Data.taggedEnum<ParsedRdxCommand>();

const decodeOptional = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  value: string | undefined,
) =>
  value === undefined
    ? Effect.succeed(undefined)
    : Schema.decodeUnknown(schema)(value);

const parseRdxCommand = (
  argv: string[],
): Effect.Effect<ParsedRdxCommand, unknown> =>
  Effect.gen(function* () {
    const command = argv.join(' ');

    if (command === 'config show') {
      return RdxCommand.ConfigShow();
    }

    if (command === 'llm') {
      return RdxCommand.Llm();
    }

    if (argv[0] === 'account' && argv[1] === 'fungibles' && argv[2]) {
      return RdxCommand.AccountFungibles({
        accountAddress: AccountAddress.make(argv[2]),
      });
    }

    if (argv[0] === 'account' && argv[1] === 'nfts' && argv[2]) {
      return RdxCommand.AccountNfts({
        accountAddress: AccountAddress.make(argv[2]),
      });
    }

    if (argv[0] === 'account' && argv[1] === 'derive') {
      return RdxCommand.AccountDerive({
        publicKeyHex: takeOption(argv, '--public-key'),
      });
    }

    if (argv[0] === 'account' && argv[1] === 'show' && argv[2]) {
      return RdxCommand.AccountShow({
        accountAddress: AccountAddress.make(argv[2]),
      });
    }

    if (argv[0] === 'tx' && argv[1] === 'path' && argv[2]) {
      return RdxCommand.TxPath({
        transactionId: TransactionId.make(argv[2]),
      });
    }

    if (argv[0] === 'tx' && argv[1] === 'prepare') {
      return RdxCommand.TxPrepare({
        manifestPath: takeOption(argv, '--manifest'),
        notaryFilePath: takeOption(argv, '--notary-file'),
        subintentsPath: takeOption(argv, '--subintents'),
      });
    }

    if (argv[0] === 'tx' && argv[1] === 'add-signatures' && argv[2]) {
      return RdxCommand.TxAddSignatures({
        transactionId: TransactionId.make(argv[2]),
        signatureFilePaths: takeRepeatedOption(argv, '--file'),
      });
    }

    if (argv[0] === 'tx' && argv[1] === 'notarize' && argv[2]) {
      return RdxCommand.TxNotarize({
        transactionId: TransactionId.make(argv[2]),
      });
    }

    if (argv[0] === 'tx' && argv[1] === 'submit' && argv[2]) {
      return RdxCommand.TxSubmit({
        transactionId: TransactionId.make(argv[2]),
      });
    }

    if (argv[0] === 'tx' && argv[1] === 'list') {
      const network = yield* decodeOptional(
        NetworkSchema,
        takeOption(argv, '--network'),
      );
      const status = yield* decodeOptional(
        ArtifactStatusSchema,
        takeOption(argv, '--status'),
      );

      return RdxCommand.TxList({
        pattern: takeOption(argv, '--pattern'),
        regex: takeOption(argv, '--regex'),
        network,
        status,
        withNetworkStatus: argv.includes('--with-network-status'),
        updateNetworkStatus: argv.includes('--update-network-status'),
      });
    }

    if (argv[0] === 'tx' && argv[1] === 'status' && argv[2]) {
      return RdxCommand.TxStatus({
        transactionId: TransactionId.make(argv[2]),
        readOnly: argv.includes('--read-only'),
      });
    }

    if (argv[0] === 'tx' && argv[1] === 'history' && argv[2]) {
      return RdxCommand.TxHistory({
        accountAddress: AccountAddress.make(argv[2]),
        limit: Number(takeOption(argv, '--limit') ?? 10),
      });
    }

    if (argv[0] === 'template' && argv[1] === 'print' && argv[2]) {
      return RdxCommand.TemplatePrint({ kind: argv[2] as TemplateKind });
    }

    return RdxCommand.Unknown({ command: argv[0] ?? '' });
  });

export const runRdxEffect = (input: RunRdxInput): Effect.Effect<RdxResult> =>
  Effect.gen(function* () {
    const { format, argv } = parseGlobalFlags(input.argv);
    const command = yield* parseRdxCommand(argv);

    return yield* RdxCommand.$match(command, {
      ConfigShow: () =>
        Effect.gen(function* () {
          const config = yield* resolveRdxConfig({ cwd: input.cwd }).pipe(
            Effect.mapError((error) => error),
          );
          return {
            exitCode: 0,
            stdout: `${renderConfigShow(format, config)}\n`,
            stderr: '',
          };
        }),
      Llm: () =>
        Effect.succeed({
          exitCode: 0,
          stdout: `${renderLlmGuide()}\n`,
          stderr: '',
        }),
      AccountFungibles: ({ accountAddress }) =>
        Effect.gen(function* () {
          const config = yield* resolveRdxConfig({ cwd: input.cwd });
          const result = yield* getAccountFungibles({
            accountAddress,
            readFungibles: (accountAddress) =>
              gatewayAccountFungibles({ config, accountAddress }),
          });
          return {
            exitCode: 0,
            stdout: `${renderCommandResult(format, result)}\n`,
            stderr: '',
          };
        }),
      AccountNfts: ({ accountAddress }) =>
        Effect.gen(function* () {
          const config = yield* resolveRdxConfig({ cwd: input.cwd });
          const result = yield* getAccountNfts({
            accountAddress,
            readNfts: (accountAddress) =>
              gatewayAccountNfts({ config, accountAddress }),
          });
          return {
            exitCode: 0,
            stdout: `${renderCommandResult(format, result)}\n`,
            stderr: '',
          };
        }),
      AccountDerive: ({ publicKeyHex }) =>
        Effect.gen(function* () {
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
        }),
      AccountShow: ({ accountAddress }) =>
        Effect.gen(function* () {
          const config = yield* resolveRdxConfig({ cwd: input.cwd });
          const result = yield* getAccountDetails({
            accountAddress,
            readDetails: (accountAddress) =>
              gatewayAccountDetails({ config, accountAddress }),
          });
          return {
            exitCode: 0,
            stdout: `${renderCommandResult(format, result)}\n`,
            stderr: '',
          };
        }),
      TxPath: ({ transactionId }) =>
        Effect.gen(function* () {
          const config = yield* resolveRdxConfig({ cwd: input.cwd });
          const artifactPath = yield* findTransactionArtifact({
            artifactRoot: config.artifactRoot,
            transactionId,
          });
          return {
            exitCode: 0,
            stdout: `${renderTxPath(format, {
              transactionId,
              artifactPath,
            })}\n`,
            stderr: '',
          };
        }),
      TxPrepare: ({ manifestPath, notaryFilePath, subintentsPath }) =>
        Effect.gen(function* () {
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
        }),
      TxAddSignatures: ({ transactionId, signatureFilePaths }) =>
        Effect.gen(function* () {
          const config = yield* resolveRdxConfig({ cwd: input.cwd });
          const result = yield* addSignaturesToArtifact({
            artifactRoot: config.artifactRoot,
            transactionId,
            signatureFilePaths,
          });
          return {
            exitCode: 0,
            stdout: `${renderAddSignatures(format, result)}\n`,
            stderr: '',
          };
        }),
      TxNotarize: ({ transactionId }) =>
        Effect.gen(function* () {
          const config = yield* resolveRdxConfig({ cwd: input.cwd });
          const result = yield* notarizeTransactionArtifact({
            artifactRoot: config.artifactRoot,
            transactionId,
          });
          return {
            exitCode: 0,
            stdout: `${renderNotarize(format, result)}\n`,
            stderr: '',
          };
        }),
      TxSubmit: ({ transactionId }) =>
        Effect.gen(function* () {
          const config = yield* resolveRdxConfig({ cwd: input.cwd });
          const result = yield* submitTransactionArtifact({
            artifactRoot: config.artifactRoot,
            transactionId,
            submitNotarizedTransaction: (notarizedTransactionHex) =>
              gatewaySubmitNotarizedTransaction({
                config,
                transactionId,
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
        }),
      TxList: ({
        pattern,
        regex,
        network,
        status,
        withNetworkStatus,
        updateNetworkStatus,
      }) =>
        Effect.gen(function* () {
          const config = yield* resolveRdxConfig({ cwd: input.cwd });
          const listInput = {
            artifactRoot: config.artifactRoot,
            pattern,
            regex,
            network,
            status,
          };
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
        }),
      TxStatus: ({ transactionId, readOnly }) =>
        Effect.gen(function* () {
          const config = yield* resolveRdxConfig({ cwd: input.cwd });
          const result = yield* queryTransactionStatus({
            artifactRoot: config.artifactRoot,
            transactionId,
            readOnly,
            getNetworkStatus: (id) =>
              gatewayTransactionStatus({ config, transactionId: id }),
          });
          return {
            exitCode: 0,
            stdout: `${renderTxStatus(format, result)}\n`,
            stderr: '',
          };
        }),
      TxHistory: ({ accountAddress, limit }) =>
        Effect.gen(function* () {
          const config = yield* resolveRdxConfig({ cwd: input.cwd });
          const result = yield* getAccountTransactionHistory({
            accountAddress,
            limit,
            readHistory: (accountAddress, itemLimit) =>
              gatewayAccountHistory({
                config,
                accountAddress,
                limit: itemLimit,
              }),
          });
          return {
            exitCode: 0,
            stdout: `${renderCommandResult(format, result)}\n`,
            stderr: '',
          };
        }),
      TemplatePrint: ({ kind }) =>
        Effect.succeed({
          exitCode: 0,
          stdout: `${renderTemplate(kind)}\n`,
          stderr: '',
        }),
      Unknown: ({ command }) =>
        Effect.succeed(
          structuredError({
            code: 'UNKNOWN_COMMAND',
            message: `Unknown command: ${command}`,
            exitCode: 64,
          }),
        ),
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
