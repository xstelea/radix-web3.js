import { createHash } from 'node:crypto';
import { basename, join } from 'node:path';

import {
  Convert,
  PublicKey,
  RadixEngineToolkit,
  type SubintentV2,
  type TransactionIntentV2,
  TransactionV2Builder,
} from '@steleaio/radix-engine-toolkit';
import { Data, Effect, Schema } from 'effect';

import { createTransactionArtifactDirectory } from './artifacts';
import type { Network, ResolvedRdxConfig } from './config';
import { gatewayErrorMessage } from './gatewayHttp';
import {
  makeDirectory,
  readFileString,
  readJsonFile,
  writeFileString,
  writeJsonFile,
} from './platformIo';
import {
  type NotaryFile,
  type PreparedTransaction,
  SubintentsFileSchema,
} from './schemas';
import {
  type SigningRequestHash,
  generateSigningRequests,
} from './signingRequests';
import { assembleRootManifest } from './subintentAssembly';

export type PrepareTransactionResult = {
  transactionId: string;
  artifactPath: string;
  preparedPath: string;
  transactionIntentPath: string;
  staticAnalysisPath: string;
  signatureTemplatePaths: string[];
  startEpochInclusive: number;
  endEpochExclusive: number;
};

export class PreparePreviewError extends Data.TaggedError(
  'PreparePreviewError',
)<{
  message?: string;
  reason?: unknown;
}> {}

const networkId = (network: Network) => (network === 'mainnet' ? 1 : 2);

const gatewayBaseUrl = (network: Network) =>
  network === 'stokenet'
    ? 'https://stokenet.radixdlt.com'
    : 'https://mainnet.radixdlt.com';

type EpochWindow = {
  startEpochInclusive: number;
  endEpochExclusive: number;
};

const defaultEpochWindow = (): EpochWindow => ({
  startEpochInclusive: 1,
  endEpochExclusive: 10,
});

const epochWindowFromCurrentEpoch = (currentEpoch?: number): EpochWindow =>
  currentEpoch === undefined
    ? defaultEpochWindow()
    : {
        startEpochInclusive: currentEpoch,
        endEpochExclusive: currentEpoch + 100,
      };

const intentDiscriminator = (input: {
  manifest: string;
  network: Network;
  notaryPublicKeyHex: string;
}) =>
  Number.parseInt(
    createHash('sha256')
      .update(input.network)
      .update('\n')
      .update(input.notaryPublicKeyHex)
      .update('\n')
      .update(input.manifest)
      .digest('hex')
      .slice(0, 8),
    16,
  );

const buildTransactionIntent = (input: {
  manifest: string;
  network: Network;
  notary: Pick<NotaryFile, 'publicKey' | 'notaryIsSignatory'>;
  childHashes?: Uint8Array[];
  nonRootSubintents?: SubintentV2[];
  epochWindow?: EpochWindow;
}) => {
  const id = networkId(input.network);
  const epochWindow = input.epochWindow ?? defaultEpochWindow();
  return {
    transactionHeader: {
      notaryPublicKey: new PublicKey.Ed25519(input.notary.publicKey.hex),
      notaryIsSignatory: input.notary.notaryIsSignatory ?? true,
      tipBasisPoints: 0,
    },
    rootIntentCore: {
      header: {
        networkId: id,
        startEpochInclusive: epochWindow.startEpochInclusive,
        endEpochExclusive: epochWindow.endEpochExclusive,
        intentDiscriminator: intentDiscriminator({
          manifest: input.manifest,
          network: input.network,
          notaryPublicKeyHex: input.notary.publicKey.hex,
        }),
      },
      instructions: input.manifest,
      blobs: [],
      message: { kind: 'None' as const },
      children: input.childHashes ?? [],
    },
    nonRootSubintents: input.nonRootSubintents ?? [],
  } satisfies TransactionIntentV2;
};

const buildSubintent = (input: {
  subintentId: string;
  manifest: string;
  network: Network;
  notaryPublicKeyHex: string;
  epochWindow?: EpochWindow;
}): SubintentV2 => ({
  intentCore: {
    header: {
      networkId: networkId(input.network),
      startEpochInclusive:
        input.epochWindow?.startEpochInclusive ??
        defaultEpochWindow().startEpochInclusive,
      endEpochExclusive:
        input.epochWindow?.endEpochExclusive ??
        defaultEpochWindow().endEpochExclusive,
      intentDiscriminator: intentDiscriminator({
        manifest: `${input.subintentId}\n${input.manifest}`,
        network: input.network,
        notaryPublicKeyHex: input.notaryPublicKeyHex,
      }),
    },
    instructions: input.manifest,
    blobs: [],
    message: { kind: 'None' as const },
    children: [],
  },
});

const encodeIntentCore = (core: TransactionIntentV2['rootIntentCore']) => ({
  header: core.header,
  instructions: core.instructions,
  blobs: [],
  message: core.message,
  children: core.children.map((child) => Convert.Uint8Array.toHexString(child)),
});

const encodeTransactionIntent = (
  intent: TransactionIntentV2,
  compiledHex: string,
) => ({
  kind: 'transactionIntentV2' as const,
  value: {
    transactionHeader: {
      notaryPublicKey: intent.transactionHeader.notaryPublicKey.hex(),
      notaryIsSignatory: intent.transactionHeader.notaryIsSignatory,
      tipBasisPoints: intent.transactionHeader.tipBasisPoints,
    },
    rootIntentCore: encodeIntentCore(intent.rootIntentCore),
    nonRootSubintents: intent.nonRootSubintents.map((subintent) => ({
      intentCore: encodeIntentCore(subintent.intentCore),
    })),
  },
  compiledHex,
});

const fallbackHashManifest = (manifest: string) => {
  const hex = createHash('sha256').update(manifest).digest('hex');
  return {
    transactionId: `txid_cli_${hex.slice(0, 32)}`,
    intentHash: {
      id: `intent_cli_${hex.slice(0, 32)}`,
      hex,
    } satisfies SigningRequestHash,
  };
};

const writeJson = (path: string, value: unknown) =>
  writeJsonFile(path, value, (reason) => reason);

const writeWorkflowFile = (
  artifactPath: string,
  relativePath: string,
  value: unknown,
) =>
  Effect.gen(function* () {
    const path = join(artifactPath, relativePath);
    yield* makeDirectory(
      join(path, '..'),
      { recursive: true },
      (reason) => reason,
    );
    yield* writeJson(path, value);
    return path;
  });

const buildPreparePreviewHex = (intent: TransactionIntentV2) =>
  Effect.gen(function* () {
    const builder = yield* Effect.tryPromise(() => TransactionV2Builder.new());
    let builderStep = builder
      .header(intent.transactionHeader)
      .rootIntentCore(intent.rootIntentCore);

    for (const subintent of intent.nonRootSubintents) {
      builderStep = builderStep.addSignedSubintent(subintent, []);
    }

    const previewTransaction = builderStep.buildPreviewTransaction({
      rootSignerPublicKeys: [],
      nonRootSubintentSignerPublicKeys: intent.nonRootSubintents.map(() => []),
    });
    const compiled = yield* Effect.tryPromise(() =>
      RadixEngineToolkit.PreviewTransactionV2.compile(previewTransaction),
    );
    return Convert.Uint8Array.toHexString(compiled);
  });

export const gatewayPreparePreview = (input: {
  config: Pick<ResolvedRdxConfig, 'network' | 'gatewayBaseUrl'>;
  previewTransactionHex: string;
}) =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(
        `${input.config.gatewayBaseUrl ?? gatewayBaseUrl(input.config.network)}/transaction/preview-v2`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            preview_transaction: {
              type: 'Compiled',
              preview_transaction_hex: input.previewTransactionHex,
            },
            flags: {
              assume_all_signature_proofs: true,
              skip_epoch_check: true,
              use_free_credit: true,
            },
            opt_ins: {
              core_api_receipt: false,
            },
          }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await Effect.runPromise(
            gatewayErrorMessage('Gateway preview', response),
          ),
        );
      }
      const body = (await response.json()) as {
        receipt?: { status?: string; error_message?: string };
      };
      if (body.receipt && body.receipt.status !== 'Succeeded') {
        throw new Error(body.receipt.error_message ?? 'Preview failed');
      }
    },
    catch: (reason) => new PreparePreviewError({ reason }),
  });

export const gatewayCurrentEpoch = (input: {
  config: Pick<ResolvedRdxConfig, 'network' | 'gatewayBaseUrl'>;
}) =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(
        `${input.config.gatewayBaseUrl ?? gatewayBaseUrl(input.config.network)}/status/gateway-status`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        },
      );
      if (!response.ok) {
        throw new Error(
          await Effect.runPromise(
            gatewayErrorMessage('Gateway status', response),
          ),
        );
      }
      const body = (await response.json()) as {
        ledger_state?: { epoch?: unknown };
      };
      if (typeof body.ledger_state?.epoch !== 'number') {
        throw new Error('Gateway status response did not include an epoch');
      }
      return body.ledger_state.epoch;
    },
    catch: (reason) => new PreparePreviewError({ reason }),
  });

export const prepareTransactionArtifacts = (input: {
  artifactRoot: string;
  network: Network;
  manifestPath: string;
  subintentsPath?: string;
  notary: Pick<NotaryFile, 'publicKey' | 'notaryIsSignatory'>;
  currentEpoch?: number;
  previewPreparedTransaction?: (
    previewTransactionHex: string,
  ) => Effect.Effect<void, unknown>;
}): Effect.Effect<PrepareTransactionResult, unknown> =>
  Effect.gen(function* () {
    const manifest = yield* readFileString(
      input.manifestPath,
      (reason) => reason,
    );
    const subintentsFile = input.subintentsPath
      ? yield* readJsonFile(input.subintentsPath, (reason) => reason).pipe(
          Effect.flatMap(Schema.decodeUnknown(SubintentsFileSchema)),
        )
      : undefined;
    const childSubintents = yield* Effect.all(
      Object.entries(subintentsFile?.subintents ?? {}).map(
        ([subintentId, subintent]) =>
          Effect.gen(function* () {
            const transactionSubintent = buildSubintent({
              subintentId,
              manifest: subintent.manifest,
              network: input.network,
              notaryPublicKeyHex: input.notary.publicKey.hex,
              epochWindow: epochWindowFromCurrentEpoch(input.currentEpoch),
            });
            const hash = yield* Effect.tryPromise(() =>
              RadixEngineToolkit.SubintentV2.hash(transactionSubintent),
            );
            return {
              subintentId,
              manifest: subintent.manifest,
              subintent: transactionSubintent,
              hash,
            };
          }),
      ),
    );
    const assembled = yield* assembleRootManifest({
      rootManifest: manifest,
      childIntentHashes: Object.fromEntries(
        childSubintents.map((subintent) => [
          subintent.subintentId,
          subintent.hash.id,
        ]),
      ),
    });
    const orderedChildSubintents = assembled.subintentOrder.map(
      (subintentId) =>
        childSubintents.find(
          (subintent) => subintent.subintentId === subintentId,
        )!,
    );
    const epochWindow = epochWindowFromCurrentEpoch(input.currentEpoch);
    const intent = buildTransactionIntent({
      manifest: assembled.rootManifest,
      network: input.network,
      notary: input.notary,
      epochWindow,
      childHashes: orderedChildSubintents.map((subintent) =>
        subintent.hash.hash.slice(),
      ),
      nonRootSubintents: orderedChildSubintents.map(
        (subintent) => subintent.subintent,
      ),
    });
    const intentHashResult = yield* Effect.tryPromise(() =>
      RadixEngineToolkit.TransactionIntentV2.hash(intent),
    );
    const compiledIntent = yield* Effect.tryPromise(() =>
      RadixEngineToolkit.TransactionIntentV2.compile(intent),
    );
    const staticAnalysisResult = yield* Effect.tryPromise(() =>
      RadixEngineToolkit.TransactionIntentV2.staticallyAnalyze(intent),
    );
    if (input.previewPreparedTransaction) {
      const previewTransactionHex = yield* buildPreparePreviewHex(intent);
      yield* input.previewPreparedTransaction(previewTransactionHex);
    }

    const fallback = fallbackHashManifest(manifest);
    const intentHash = {
      id: intentHashResult.id,
      hex:
        Convert.Uint8Array.toHexString(intentHashResult.hash) ??
        fallback.intentHash.hex,
    };
    const transactionId = intentHashResult.id ?? fallback.transactionId;
    const artifactPath = yield* createTransactionArtifactDirectory({
      artifactRoot: input.artifactRoot,
      transactionId,
    });

    yield* writeFileString(
      join(artifactPath, 'rootManifest.rtm'),
      assembled.rootManifest,
      (reason) => reason,
    );
    yield* Effect.all(
      orderedChildSubintents.map((subintent) =>
        Effect.gen(function* () {
          const path = join(
            artifactPath,
            'subintents',
            `${subintent.subintentId}.rtm`,
          );
          yield* makeDirectory(
            join(path, '..'),
            { recursive: true },
            (reason) => reason,
          );
          yield* writeFileString(path, subintent.manifest, (reason) => reason);
        }),
      ),
    );

    const transactionIntent = {
      type: 'transactionIntent',
      version: 1,
      transactionId,
      encoded: encodeTransactionIntent(
        intent,
        Convert.Uint8Array.toHexString(compiledIntent),
      ),
    };
    const staticAnalysis = {
      type: 'staticAnalysis',
      version: 1,
      transactionId,
      analysis: staticAnalysisResult,
    };
    const authorizationAnalysis = {
      rootIntent: staticAnalysisResult.root_intent.accounts_requiring_auth,
      subintents: Object.fromEntries(
        staticAnalysisResult.non_root_subintents.map((subintent, index) => [
          assembled.subintentOrder[index] ?? `subintent-${index}`,
          subintent.accounts_requiring_auth,
        ]),
      ),
    };
    const subintentHashes = Object.fromEntries(
      orderedChildSubintents.map((subintent) => [
        subintent.subintentId,
        {
          id: subintent.hash.id,
          hex: Convert.Uint8Array.toHexString(subintent.hash.hash),
        },
      ]),
    );

    const generated = yield* generateSigningRequests({
      transactionId,
      rootIntentHash: intentHash,
      subintentHashes,
      authorizationAnalysis,
      notary: {
        publicKey: input.notary.publicKey,
        notaryIsSignatory: input.notary.notaryIsSignatory ?? true,
      },
    });

    yield* Effect.all(
      generated.requests.map((request) =>
        writeWorkflowFile(artifactPath, request.path, request.file),
      ),
    );
    const signatureTemplatePaths = yield* Effect.all(
      generated.templates.map((template) =>
        writeWorkflowFile(artifactPath, template.path, template.file),
      ),
    );

    const prepared: PreparedTransaction = {
      type: 'preparedTransaction',
      version: 1,
      transactionId,
      network: input.network,
      intentHash,
      manifestSourceFile: basename(input.manifestPath),
      transactionIntentPath: 'transactionIntent.json',
      staticAnalysisPath: 'staticAnalysis.json',
      signingRequests: generated.requests.map((request) => request.path),
      signatureTemplates: generated.templates.map((template) => template.path),
      subintentOrder: assembled.subintentOrder,
      authorizationAnalysis,
      notaryPublicKey: input.notary.publicKey,
      notaryIsSignatory: input.notary.notaryIsSignatory ?? true,
    };

    const transactionIntentPath = join(artifactPath, 'transactionIntent.json');
    const staticAnalysisPath = join(artifactPath, 'staticAnalysis.json');
    const preparedPath = join(artifactPath, 'prepared.json');

    yield* writeJson(transactionIntentPath, transactionIntent);
    yield* writeJson(staticAnalysisPath, staticAnalysis);
    yield* writeJson(preparedPath, prepared);

    return {
      transactionId,
      artifactPath,
      preparedPath,
      transactionIntentPath,
      staticAnalysisPath,
      signatureTemplatePaths,
      startEpochInclusive: epochWindow.startEpochInclusive,
      endEpochExclusive: epochWindow.endEpochExclusive,
    };
  });

export class TransactionPreparer extends Effect.Service<TransactionPreparer>()(
  'TransactionPreparer',
  {
    sync: () => ({
      prepareTransactionArtifacts,
      gatewayPreparePreview,
      gatewayCurrentEpoch,
    }),
  },
) {}
