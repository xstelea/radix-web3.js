import { basename, dirname, join } from 'node:path';
import {
  Convert,
  RadixEngineToolkit,
  SignatureWithPublicKey,
  type SignedPartialTransactionV2,
  type SubintentV2,
} from '@steleaio/radix-engine-toolkit';
import { Data, Effect, Schema } from 'effect';
import { createTransactionArtifactDirectory } from './artifacts';
import {
  makeDirectory,
  readFileString,
  readJsonFile,
  writeFileString,
  writeJsonFile,
} from './platformIo';
import {
  PLACEHOLDER_PUBLIC_KEY_HEX,
  PLACEHOLDER_SIGNATURE_HEX,
  type PreparedSubintent,
  PreparedSubintentSchema,
  type SignatureEntry,
  SignatureFileSchema,
  type SignatureTemplate,
  type SigningRequest,
  SubintentHeaderFileSchema,
} from './schemas';

const subintentHashPlaceholder = '<subintentHash>';

export type PrepareSubintentResult = {
  subintentHash: PreparedSubintent['subintentHash'];
  artifactPath: string;
  preparedPath: string;
  signatureTemplatePath: string;
  signingRequestPath: string;
};

export type BuildSignedPartialTransactionResult = {
  subintentHash: PreparedSubintent['subintentHash'];
  artifactPath: string;
  signedPartialTransactionPath: string;
  signedPartialTransactionHex: string;
};

export class SubintentPreviewRootManifestError extends Data.TaggedError(
  'SubintentPreviewRootManifestError',
)<{
  placeholderCount: number;
}> {}

const writeJson = (path: string, value: unknown) =>
  writeJsonFile(path, value, (reason) => reason);

const writeWorkflowJson = (
  artifactPath: string,
  relativePath: string,
  value: unknown,
) =>
  Effect.gen(function* () {
    const path = join(artifactPath, relativePath);
    yield* makeDirectory(
      dirname(path),
      { recursive: true },
      (reason) => reason,
    );
    yield* writeJson(path, value);
    return path;
  });

const messageFromHeaderFile = (
  message: string | undefined,
): SubintentV2['intentCore']['message'] =>
  message === undefined
    ? { kind: 'None' }
    : {
        kind: 'PlainText',
        value: {
          mimeType: 'text/plain',
          message: {
            kind: 'String',
            value: message,
          },
        },
      };

const signatureEntryToRet = (entry: SignatureEntry) =>
  new SignatureWithPublicKey.Ed25519(entry.signature.hex, entry.publicKey.hex);

const buildRootSubintent = (input: {
  manifest: string;
  headerPath: string;
}) =>
  readJsonFile(input.headerPath, (reason) => reason).pipe(
    Effect.flatMap(Schema.decodeUnknown(SubintentHeaderFileSchema)),
    Effect.map(
      (headerFile): SubintentV2 => ({
        intentCore: {
          header: headerFile.header,
          instructions: input.manifest,
          blobs: [],
          message: messageFromHeaderFile(headerFile.message),
          children: [],
        },
      }),
    ),
  );

const writePreviewRootManifest = (input: {
  artifactPath: string;
  rootManifestPath: string | undefined;
  subintentHashId: string | null;
  noPreview: boolean | undefined;
}) =>
  Effect.gen(function* () {
    if (input.rootManifestPath === undefined) {
      const previewResultPath = yield* writeWorkflowJson(
        input.artifactPath,
        'preview-result.json',
        {
          type: 'subintentPreview',
          version: 1,
          status: input.noPreview ? 'skipped' : 'missing-root-manifest',
        },
      );
      return {
        previewRootManifestPath: undefined,
        previewResultPath,
      };
    }

    const rootManifest = yield* readFileString(
      input.rootManifestPath,
      (reason) => reason,
    );
    const placeholderCount =
      rootManifest.split(subintentHashPlaceholder).length - 1;
    if (placeholderCount !== 1) {
      return yield* new SubintentPreviewRootManifestError({
        placeholderCount,
      });
    }

    const previewRootManifestPath = join(
      input.artifactPath,
      'preview-root.rtm',
    );
    yield* writeFileString(
      previewRootManifestPath,
      rootManifest.replace(
        subintentHashPlaceholder,
        input.subintentHashId ?? '',
      ),
      (reason) => reason,
    );
    const previewResultPath = yield* writeWorkflowJson(
      input.artifactPath,
      'preview-result.json',
      {
        type: 'subintentPreview',
        version: 1,
        status: 'prepared',
      },
    );

    return {
      previewRootManifestPath,
      previewResultPath,
    };
  });

export const prepareSubintentArtifacts = (input: {
  artifactRoot: string;
  manifestPath: string;
  headerPath: string;
  rootManifestPath?: string;
  noPreview?: boolean;
}): Effect.Effect<PrepareSubintentResult, unknown> =>
  Effect.gen(function* () {
    const manifest = yield* readFileString(
      input.manifestPath,
      (reason) => reason,
    );
    const rootSubintent = yield* buildRootSubintent({
      manifest,
      headerPath: input.headerPath,
    });
    const hash = yield* Effect.tryPromise(() =>
      RadixEngineToolkit.SubintentV2.hash(rootSubintent),
    );
    yield* Effect.tryPromise(() =>
      RadixEngineToolkit.SubintentV2.staticallyAnalyze(rootSubintent),
    );

    const subintentHash = {
      id: hash.id,
      hex: Convert.Uint8Array.toHexString(hash.hash),
    };
    const artifactPath = yield* createTransactionArtifactDirectory({
      artifactRoot: input.artifactRoot,
      transactionId: subintentHash.id ?? `subintent_${subintentHash.hex}`,
    });
    const { previewRootManifestPath, previewResultPath } =
      yield* writePreviewRootManifest({
        artifactPath,
        rootManifestPath: input.rootManifestPath,
        subintentHashId: subintentHash.id,
        noPreview: input.noPreview,
      });

    const signingRequest: SigningRequest = {
      type: 'signingRequest',
      version: 1,
      transactionId: subintentHash.id ?? subintentHash.hex,
      scope: { kind: 'subintent', subintentId: 'root' },
      account: null,
      hash: subintentHash,
      signingRequestPath: 'signing-request.json',
    };
    const signatureTemplate: SignatureTemplate = {
      type: 'signatureTemplate',
      version: 1,
      transactionId: subintentHash.id ?? subintentHash.hex,
      scope: { kind: 'subintent', subintentId: 'root' },
      account: null,
      hash: subintentHash,
      signingRequestPath: 'signing-request.json',
      publicKey: { curve: 'Ed25519', hex: PLACEHOLDER_PUBLIC_KEY_HEX },
      signature: { curve: 'Ed25519', hex: PLACEHOLDER_SIGNATURE_HEX },
    };
    const prepared: PreparedSubintent = {
      type: 'preparedSubintent',
      version: 1,
      subintentHash,
      networkId: rootSubintent.intentCore.header.networkId,
      manifestSourceFile: basename(input.manifestPath),
      headerSourceFile: basename(input.headerPath),
      subintentPath: 'subintent.json',
      subintentManifestPath: 'subintent.rtm',
      subintentHeaderPath: 'subintent-header.json',
      signingRequestPath: 'signing-request.json',
      signatureTemplatePath: 'signature-template.json',
      previewRootManifestPath:
        previewRootManifestPath === undefined
          ? undefined
          : basename(previewRootManifestPath),
      previewResultPath: basename(previewResultPath),
    };

    yield* writeFileString(
      join(artifactPath, 'subintent.rtm'),
      manifest,
      (reason) => reason,
    );
    yield* writeJson(join(artifactPath, 'subintent-header.json'), {
      type: 'subintentHeader',
      version: 1,
      header: rootSubintent.intentCore.header,
      message:
        rootSubintent.intentCore.message.kind === 'PlainText'
          ? rootSubintent.intentCore.message.value.message.value
          : undefined,
    });
    yield* writeJson(join(artifactPath, 'subintent.json'), rootSubintent);
    const signingRequestPath = yield* writeWorkflowJson(
      artifactPath,
      'signing-request.json',
      signingRequest,
    );
    const signatureTemplatePath = yield* writeWorkflowJson(
      artifactPath,
      'signature-template.json',
      signatureTemplate,
    );
    const preparedPath = join(artifactPath, 'prepared-subintent.json');
    yield* writeJson(preparedPath, prepared);

    return {
      subintentHash,
      artifactPath,
      preparedPath,
      signatureTemplatePath,
      signingRequestPath,
    };
  });

export const buildSignedPartialTransaction = (input: {
  preparedPath: string;
  signaturePath: string;
}): Effect.Effect<BuildSignedPartialTransactionResult, unknown> =>
  Effect.gen(function* () {
    const artifactPath = dirname(input.preparedPath);
    const prepared = yield* readJsonFile(
      input.preparedPath,
      (reason) => reason,
    ).pipe(Effect.flatMap(Schema.decodeUnknown(PreparedSubintentSchema)));
    const rootSubintent = yield* readJsonFile(
      join(artifactPath, prepared.subintentPath),
      (reason) => reason,
    );
    const signatureFile = yield* readJsonFile(
      input.signaturePath,
      (reason) => reason,
    ).pipe(Effect.flatMap(Schema.decodeUnknown(SignatureFileSchema)));
    const rootSignatures = signatureFile.signatures
      .filter(
        (entry) =>
          entry.scope.kind === 'subintent' &&
          entry.scope.subintentId === 'root' &&
          entry.hash.hex === prepared.subintentHash.hex,
      )
      .map(signatureEntryToRet);
    const signedPartialTransaction: SignedPartialTransactionV2 = {
      partialTransaction: {
        rootSubintent: yield* Schema.decodeUnknown(Schema.Any)(rootSubintent),
        nonRootSubintents: [],
      },
      rootSubintentSignatures: rootSignatures,
      nonRootSubintentSignatures: [],
    };
    const compiled = yield* Effect.tryPromise(() =>
      RadixEngineToolkit.SignedPartialTransactionV2.compile(
        signedPartialTransaction,
      ),
    );
    const signedPartialTransactionHex =
      Convert.Uint8Array.toHexString(compiled);
    const signedPartialTransactionPath = join(
      artifactPath,
      'signed-partial-transaction.hex',
    );
    yield* writeFileString(
      signedPartialTransactionPath,
      signedPartialTransactionHex,
      (reason) => reason,
    );

    return {
      subintentHash: prepared.subintentHash,
      artifactPath,
      signedPartialTransactionPath,
      signedPartialTransactionHex,
    };
  });
