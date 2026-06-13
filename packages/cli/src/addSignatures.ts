import { join } from 'node:path';

import { Effect, Schema } from 'effect';

import {
  type SignatureImportResult,
  findTransactionArtifact,
  writeCanonicalSignatures,
} from './artifacts';
import { readJsonFile } from './platformIo';
import {
  PreparedTransactionSchema,
  type SignatureEntry,
  SignatureFileSchema,
  type SigningRequest,
  SigningRequestSchema,
} from './schemas';
import { importSignatures } from './signatureImport';

export type AddSignaturesResult = SignatureImportResult & {
  signaturesPath: string;
  complete: boolean;
};

const readJson = (path: string) => readJsonFile(path, (reason) => reason);

const readPrepared = (artifactPath: string) =>
  readJson(join(artifactPath, 'prepared.json')).pipe(
    Effect.flatMap(Schema.decodeUnknown(PreparedTransactionSchema)),
  );

const readSigningRequest = (artifactPath: string, requestPath: string) =>
  readJson(join(artifactPath, requestPath)).pipe(
    Effect.flatMap(Schema.decodeUnknown(SigningRequestSchema)),
  );

const readExistingSignatures = (artifactPath: string) =>
  readJson(join(artifactPath, 'signatures.json')).pipe(
    Effect.flatMap(Schema.decodeUnknown(SignatureFileSchema)),
    Effect.map((file) => file.signatures),
    Effect.catchAll(() => Effect.succeed([] as SignatureEntry[])),
  );

const requestComplete = (
  request: SigningRequest,
  signatures: readonly SignatureEntry[],
) =>
  signatures.some(
    (signature) =>
      signature.scope.kind === request.scope.kind &&
      (signature.scope.kind !== 'subintent' ||
        (request.scope.kind === 'subintent' &&
          signature.scope.subintentId === request.scope.subintentId)) &&
      signature.account === request.account &&
      signature.hash.hex === request.hash.hex &&
      signature.hash.id === request.hash.id,
  );

export const addSignaturesToArtifact = (input: {
  artifactRoot: string;
  transactionId: string;
  signatureFilePaths: string[];
}): Effect.Effect<AddSignaturesResult, unknown> =>
  Effect.gen(function* () {
    const artifactPath = yield* findTransactionArtifact(input);
    const prepared = yield* readPrepared(artifactPath);
    const generatedRequests = yield* Effect.all(
      prepared.signingRequests.map((requestPath) =>
        readSigningRequest(artifactPath, requestPath),
      ),
    );
    const existing = yield* readExistingSignatures(artifactPath);
    const files = yield* Effect.all(
      input.signatureFilePaths.map((signatureFilePath) =>
        readJson(signatureFilePath),
      ),
    );
    const importResult = yield* importSignatures({
      transactionId: input.transactionId,
      generatedRequests,
      existing,
      files,
    });
    const signaturesPath = yield* writeCanonicalSignatures({
      artifactPath,
      transactionId: input.transactionId,
      existing: [],
      imported: importResult.signatureFile.signatures,
    });
    const complete = generatedRequests.every((request) =>
      requestComplete(request, importResult.signatureFile.signatures),
    );

    return {
      ...importResult,
      signaturesPath,
      complete,
    };
  });

export class AddSignaturesWorkflow extends Effect.Service<AddSignaturesWorkflow>()(
  'AddSignaturesWorkflow',
  {
    sync: () => ({
      addSignaturesToArtifact,
    }),
  },
) {}
