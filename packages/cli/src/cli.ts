import { readFile } from 'node:fs/promises';
import { Args, Command, Options } from '@effect/cli';
import { Console, Effect, Option, Schema } from 'effect';
import {
  gatewayAccountBalance,
  gatewayAccountDetails,
  gatewayAccountHistory,
  deriveVirtualAccountAddress,
  getAccountBalance,
  getAccountDetails,
  getAccountTransactionHistory,
} from './accountReads';
import {
  type AddSignaturesResult,
  addSignaturesToArtifact,
} from './addSignatures';
import type { VirtualAccountDerivation } from './accountReads';
import {
  type TransactionArtifactSummary,
  findTransactionArtifact,
  listTransactionArtifacts,
} from './artifacts';
import { type ResolvedRdxConfig, resolveRdxConfig } from './config';
import {
  type NotarizeTransactionResult,
  gatewayNotarizePreview,
  notarizeTransactionArtifact,
} from './notarize';
import { llmGuide } from './llm';
import {
  type PrepareTransactionResult,
  gatewayPreparePreview,
  prepareTransactionArtifacts,
} from './prepare';
import {
  type ArtifactStatus,
  NotaryFileSchema,
  type PreparedTransaction,
} from './schemas';
import {
  type TransactionStatusResult,
  gatewayTransactionStatus,
  listTransactionArtifactsWithNetworkStatus,
  queryTransactionStatus,
} from './status';
import {
  type SubmitTransactionResult,
  gatewaySubmitNotarizedTransaction,
  submitTransactionArtifact,
} from './submit';
import { type TemplateKind, workflowTemplate } from './templates';

export type OutputFormat = 'json' | 'text';

const formatOption = Options.choice('format', ['json', 'text'] as const).pipe(
  Options.withDefault('json' as const),
  Options.withDescription('Output format'),
);

export const renderJson = (value: unknown) => JSON.stringify(value, null, 2);

export const renderConfigShow = (
  format: OutputFormat,
  config: Pick<ResolvedRdxConfig, 'network' | 'artifactScope' | 'artifactRoot'>,
) => {
  const result = {
    type: 'commandResult',
    command: 'config show',
    network: config.network,
    artifactScope: config.artifactScope,
    artifactRoot: config.artifactRoot,
  };

  if (format === 'text') {
    return `network: ${result.network}\nartifactScope: ${result.artifactScope}`;
  }

  return renderJson(result);
};

export const renderTxPath = (
  format: OutputFormat,
  input: { transactionId: string; artifactPath: string },
) => {
  const result = {
    type: 'commandResult',
    command: 'tx path',
    transactionId: input.transactionId,
    artifactPath: input.artifactPath,
  };

  if (format === 'text') {
    return input.artifactPath;
  }

  return renderJson(result);
};

export const renderTxList = (
  format: OutputFormat,
  artifacts: TransactionArtifactSummary[],
) => {
  const result = {
    type: 'commandResult',
    command: 'tx list',
    artifacts,
  };

  if (format === 'text') {
    return artifacts
      .map(
        (artifact) =>
          `${artifact.transactionId}\t${artifact.network}\t${artifact.status}\t${artifact.networkStatus?.status ?? 'local'}\t${artifact.path}`,
      )
      .join('\n');
  }

  return renderJson(result);
};

export const renderTemplate = (kind: TemplateKind) =>
  renderJson(workflowTemplate(kind));

export const renderLlmGuide = () => llmGuide;

export const renderAddSignatures = (
  format: OutputFormat,
  result: Pick<
    AddSignaturesResult,
    'acceptedCount' | 'warnings' | 'complete' | 'signaturesPath'
  >,
) => {
  const commandResult = {
    type: 'commandResult',
    command: 'tx add-signatures',
    acceptedCount: result.acceptedCount,
    warnings: result.warnings,
    complete: result.complete,
    signaturesPath: result.signaturesPath,
  };

  if (format === 'text') {
    return `accepted: ${result.acceptedCount}\ncomplete: ${result.complete}\nsignaturesPath: ${result.signaturesPath}`;
  }

  return renderJson(commandResult);
};

export const renderTxStatus = (
  format: OutputFormat,
  result: TransactionStatusResult,
) => {
  const commandResult = {
    type: 'commandResult',
    command: 'tx status',
    transactionId: result.transactionId,
    artifactPath: result.artifactPath,
    networkStatus: result.networkStatus,
    updatedSubmitResultPath: result.updatedSubmitResultPath,
  };

  if (format === 'text') {
    return `${result.transactionId}\t${result.networkStatus.status}`;
  }

  return renderJson(commandResult);
};

export const renderPrepare = (
  format: OutputFormat,
  result: PrepareTransactionResult,
) => {
  const commandResult = {
    type: 'commandResult',
    command: 'tx prepare',
    transactionId: result.transactionId,
    artifactPath: result.artifactPath,
    preparedPath: result.preparedPath,
    transactionIntentPath: result.transactionIntentPath,
    staticAnalysisPath: result.staticAnalysisPath,
    signatureTemplatePaths: result.signatureTemplatePaths,
  };

  if (format === 'text') {
    return result.preparedPath;
  }

  return renderJson(commandResult);
};

export const renderNotarize = (
  format: OutputFormat,
  result: NotarizeTransactionResult,
) => {
  const commandResult = {
    type: 'commandResult',
    command: 'tx notarize',
    transactionId: result.transactionId,
    artifactPath: result.artifactPath,
    signedTransactionIntentPath: result.signedTransactionIntentPath,
    notarySigningRequestPath: result.notarySigningRequestPath,
    notarySignatureTemplatePath: result.notarySignatureTemplatePath,
  };

  if (format === 'text') {
    return result.notarySignatureTemplatePath;
  }

  return renderJson(commandResult);
};

export const renderSubmit = (
  format: OutputFormat,
  result: SubmitTransactionResult,
) => {
  const commandResult = {
    type: 'commandResult',
    command: 'tx submit',
    transactionId: result.transactionId,
    artifactPath: result.artifactPath,
    notarizedTransactionPath: result.notarizedTransactionPath,
    submitResultPath: result.submitResultPath,
    networkStatus: result.networkStatus,
  };

  if (format === 'text') {
    return `${result.transactionId}\t${result.networkStatus.status}`;
  }

  return renderJson(commandResult);
};

export const renderCommandResult = (format: OutputFormat, result: unknown) => {
  if (format === 'text') {
    return JSON.stringify(result);
  }

  return renderJson(result);
};

export const renderAccountDerive = (
  format: OutputFormat,
  result: {
    type: 'commandResult';
    command: 'account derive';
  } & VirtualAccountDerivation,
) => {
  if (format === 'text') {
    return result.accountAddress;
  }

  return renderJson(result);
};

const rdxCommand = Command.make('rdx', { format: formatOption }).pipe(
  Command.withDescription('Agent-first Radix transaction workflow CLI'),
);

const configCommand = Command.make('config').pipe(
  Command.withDescription('Inspect rdx configuration'),
);

const configShowCommand = Command.make('show', {}, () =>
  Effect.gen(function* () {
    const { format } = yield* rdxCommand;
    const config = yield* resolveRdxConfig({ cwd: process.cwd() });
    yield* Console.log(renderConfigShow(format, config));
  }),
).pipe(Command.withDescription('Print resolved configuration'));

const llmCommand = Command.make('llm', {}, () =>
  Console.log(renderLlmGuide()),
).pipe(Command.withDescription('Print compact Markdown instructions for agents'));

const accountCommand = Command.make('account').pipe(
  Command.withDescription('Read account state'),
);

const accountAddressArg = Args.text({ name: 'accountAddress' }).pipe(
  Args.withDescription('Radix account address'),
);

const publicKeyOption = Options.text('public-key').pipe(
  Options.withDescription('Ed25519 public key hex'),
);

const accountDeriveCommand = Command.make(
  'derive',
  { publicKey: publicKeyOption },
  ({ publicKey }) =>
    Effect.gen(function* () {
      const { format } = yield* rdxCommand;
      const config = yield* resolveRdxConfig({ cwd: process.cwd() });
      const result = yield* deriveVirtualAccountAddress({
        network: config.network,
        publicKeyHex: publicKey,
      });
      yield* Console.log(renderAccountDerive(format, result));
    }),
).pipe(Command.withDescription('Derive a virtual account address'));

const accountBalanceCommand = Command.make(
  'balance',
  { accountAddress: accountAddressArg },
  ({ accountAddress }) =>
    Effect.gen(function* () {
      const { format } = yield* rdxCommand;
      const config = yield* resolveRdxConfig({ cwd: process.cwd() });
      const result = yield* getAccountBalance({
        accountAddress,
        readBalance: (address) =>
          gatewayAccountBalance({ config, accountAddress: address }),
      });
      yield* Console.log(renderCommandResult(format, result));
    }),
).pipe(Command.withDescription('Read account balances'));

const accountShowCommand = Command.make(
  'show',
  { accountAddress: accountAddressArg },
  ({ accountAddress }) =>
    Effect.gen(function* () {
      const { format } = yield* rdxCommand;
      const config = yield* resolveRdxConfig({ cwd: process.cwd() });
      const result = yield* getAccountDetails({
        accountAddress,
        readDetails: (address) =>
          gatewayAccountDetails({ config, accountAddress: address }),
      });
      yield* Console.log(renderCommandResult(format, result));
    }),
).pipe(Command.withDescription('Read account details'));

const txCommand = Command.make('tx').pipe(
  Command.withDescription('Work with transaction artifacts'),
);

const manifestOption = Options.file('manifest', { exists: 'yes' }).pipe(
  Options.withDescription('Root Transaction Manifest V2 file'),
);
const notaryFileOption = Options.file('notary-file', { exists: 'yes' }).pipe(
  Options.optional,
  Options.withDescription('Notary public key workflow file'),
);
const subintentsOption = Options.file('subintents', { exists: 'yes' }).pipe(
  Options.optional,
  Options.withDescription('Direct child subintents workflow file'),
);

const transactionIdArg = Args.text({ name: 'transactionId' }).pipe(
  Args.withDescription('Deterministic Radix transaction ID'),
);

const txPathCommand = Command.make(
  'path',
  { transactionId: transactionIdArg },
  ({ transactionId }) =>
    Effect.gen(function* () {
      const { format } = yield* rdxCommand;
      const config = yield* resolveRdxConfig({ cwd: process.cwd() });
      const artifactPath = yield* findTransactionArtifact({
        artifactRoot: config.artifactRoot,
        transactionId,
      });
      yield* Console.log(renderTxPath(format, { transactionId, artifactPath }));
    }),
).pipe(Command.withDescription('Locate a transaction artifact directory'));

const txPrepareCommand = Command.make(
  'prepare',
  {
    manifest: manifestOption,
    notaryFile: notaryFileOption,
    subintents: subintentsOption,
  },
  ({ manifest, notaryFile, subintents }) =>
    Effect.gen(function* () {
      const { format } = yield* rdxCommand;
      const config = yield* resolveRdxConfig({ cwd: process.cwd() });
      const notaryFilePath = Option.getOrUndefined(notaryFile);
      const notary = notaryFilePath
        ? yield* Effect.tryPromise(() =>
            readFile(notaryFilePath, 'utf8').then(JSON.parse),
          ).pipe(Effect.flatMap(Schema.decodeUnknown(NotaryFileSchema)))
        : config.notary;
      if (!notary) {
        return yield* Effect.fail(
          new Error(
            'tx prepare requires --notary-file or config notary settings',
          ),
        );
      }
      const result = yield* prepareTransactionArtifacts({
        artifactRoot: config.artifactRoot,
        network: config.network,
        manifestPath: manifest,
        subintentsPath: Option.getOrUndefined(subintents),
        notary,
        previewPreparedTransaction: (previewTransactionHex) =>
          gatewayPreparePreview({ config, previewTransactionHex }),
      });
      yield* Console.log(renderPrepare(format, result));
    }),
).pipe(Command.withDescription('Prepare transaction artifacts'));

const patternOption = Options.text('pattern').pipe(Options.optional);
const regexOption = Options.text('regex').pipe(Options.optional);
const networkOption = Options.choice('network', [
  'mainnet',
  'stokenet',
] as const).pipe(Options.optional);
const statusOption = Options.choice('status', [
  'prepared',
  'notarized',
  'submitted',
] as const).pipe(Options.optional);
const withNetworkStatusOption = Options.boolean('with-network-status').pipe(
  Options.withDescription('Query Gateway status for each listed artifact'),
);
const updateNetworkStatusOption = Options.boolean('update-network-status').pipe(
  Options.withDescription('Persist refreshed Gateway status into artifacts'),
);

const txListCommand = Command.make(
  'list',
  {
    pattern: patternOption,
    regex: regexOption,
    network: networkOption,
    status: statusOption,
    withNetworkStatus: withNetworkStatusOption,
    updateNetworkStatus: updateNetworkStatusOption,
  },
  ({
    network,
    pattern,
    regex,
    status,
    updateNetworkStatus,
    withNetworkStatus,
  }) =>
    Effect.gen(function* () {
      const { format } = yield* rdxCommand;
      const config = yield* resolveRdxConfig({ cwd: process.cwd() });
      const listInput = {
        artifactRoot: config.artifactRoot,
        pattern: Option.getOrUndefined(pattern),
        regex: Option.getOrUndefined(regex),
        network: Option.getOrUndefined(network) as
          | PreparedTransaction['network']
          | undefined,
        status: Option.getOrUndefined(status) as ArtifactStatus | undefined,
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
      yield* Console.log(renderTxList(format, artifacts));
    }),
).pipe(Command.withDescription('List local transaction artifacts'));

const signatureFileOption = Options.file('file', { exists: 'yes' }).pipe(
  Options.atLeast(1),
  Options.withDescription('Signature file, batch file, or filled template'),
);

const txAddSignaturesCommand = Command.make(
  'add-signatures',
  {
    transactionId: transactionIdArg,
    files: signatureFileOption,
  },
  ({ files, transactionId }) =>
    Effect.gen(function* () {
      const { format } = yield* rdxCommand;
      const config = yield* resolveRdxConfig({ cwd: process.cwd() });
      const result = yield* addSignaturesToArtifact({
        artifactRoot: config.artifactRoot,
        transactionId,
        signatureFilePaths: files,
      });
      yield* Console.log(renderAddSignatures(format, result));
    }),
).pipe(Command.withDescription('Import out-of-band signatures'));

const txNotarizeCommand = Command.make(
  'notarize',
  { transactionId: transactionIdArg },
  ({ transactionId }) =>
    Effect.gen(function* () {
      const { format } = yield* rdxCommand;
      const config = yield* resolveRdxConfig({ cwd: process.cwd() });
      const result = yield* notarizeTransactionArtifact({
        artifactRoot: config.artifactRoot,
        transactionId,
        previewSignedTransactionIntent: (previewTransactionHex) =>
          gatewayNotarizePreview({ config, previewTransactionHex }),
      });
      yield* Console.log(renderNotarize(format, result));
    }),
).pipe(Command.withDescription('Create notary signing artifacts'));

const txSubmitCommand = Command.make(
  'submit',
  { transactionId: transactionIdArg },
  ({ transactionId }) =>
    Effect.gen(function* () {
      const { format } = yield* rdxCommand;
      const config = yield* resolveRdxConfig({ cwd: process.cwd() });
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
      yield* Console.log(renderSubmit(format, result));
    }),
).pipe(Command.withDescription('Compile and submit a notarized transaction'));

const readOnlyOption = Options.boolean('read-only').pipe(
  Options.withDescription('Do not update local transaction artifacts'),
);

const txStatusCommand = Command.make(
  'status',
  {
    transactionId: transactionIdArg,
    readOnly: readOnlyOption,
  },
  ({ readOnly, transactionId }) =>
    Effect.gen(function* () {
      const { format } = yield* rdxCommand;
      const config = yield* resolveRdxConfig({ cwd: process.cwd() });
      const result = yield* queryTransactionStatus({
        artifactRoot: config.artifactRoot,
        transactionId,
        readOnly,
        getNetworkStatus: (id) =>
          gatewayTransactionStatus({ config, transactionId: id }),
      });
      yield* Console.log(renderTxStatus(format, result));
    }),
).pipe(Command.withDescription('Query Gateway transaction status'));

const historyLimitOption = Options.integer('limit').pipe(
  Options.withDefault(10),
  Options.withDescription('Maximum transactions to return'),
);

const txHistoryCommand = Command.make(
  'history',
  {
    accountAddress: accountAddressArg,
    limit: historyLimitOption,
  },
  ({ accountAddress, limit }) =>
    Effect.gen(function* () {
      const { format } = yield* rdxCommand;
      const config = yield* resolveRdxConfig({ cwd: process.cwd() });
      const result = yield* getAccountTransactionHistory({
        accountAddress,
        limit,
        readHistory: (address, itemLimit) =>
          gatewayAccountHistory({
            config,
            accountAddress: address,
            limit: itemLimit,
          }),
      });
      yield* Console.log(renderCommandResult(format, result));
    }),
).pipe(Command.withDescription('Read account transaction history'));

const templateCommand = Command.make('template').pipe(
  Command.withDescription('Print workflow file templates'),
);

const templateKindArg = Args.choice<TemplateKind>(
  [
    ['subintents', 'subintents'],
    ['signing-request', 'signing-request'],
    ['signature-template', 'signature-template'],
    ['signature-file', 'signature-file'],
  ],
  { name: 'kind' },
).pipe(Args.withDescription('Workflow template kind'));

const templatePrintCommand = Command.make(
  'print',
  { kind: templateKindArg },
  ({ kind }) => Console.log(renderTemplate(kind)),
).pipe(Command.withDescription('Print a JSON workflow template'));

export const command = rdxCommand.pipe(
  Command.withSubcommands([
    accountCommand.pipe(
      Command.withSubcommands([
        accountBalanceCommand,
        accountDeriveCommand,
        accountShowCommand,
      ]),
    ),
    configCommand.pipe(Command.withSubcommands([configShowCommand])),
    llmCommand,
    templateCommand.pipe(Command.withSubcommands([templatePrintCommand])),
    txCommand.pipe(
      Command.withSubcommands([
        txAddSignaturesCommand,
        txNotarizeCommand,
        txPrepareCommand,
        txPathCommand,
        txListCommand,
        txSubmitCommand,
        txStatusCommand,
        txHistoryCommand,
      ]),
    ),
  ]),
);

export const cli = Command.run(command, {
  name: 'rdx',
  version: '0.1.0',
});
