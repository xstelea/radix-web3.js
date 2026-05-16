import { ed25519 } from '@noble/curves/ed25519';
import { Data, Effect, Schema } from 'effect';
import { type SignatureImportResult, normalizeSignatures } from './artifacts';
import {
  BatchSignatureFileSchema,
  PLACEHOLDER_PUBLIC_KEY_HEX,
  PLACEHOLDER_SIGNATURE_HEX,
  type SignatureEntry,
  type SignatureFile,
  SignatureFileSchema,
  type SignatureTemplate,
  SignatureTemplateSchema,
  type SigningRequest,
} from './schemas';

export class SignatureImportError extends Data.TaggedError(
  'SignatureImportError',
)<{
  code:
    | 'INVALID_SIGNATURE_FILE'
    | 'UNKNOWN_SIGNING_REQUEST'
    | 'PLACEHOLDER_VALUE'
    | 'INVALID_SIGNATURE';
  reason: unknown;
}> {}

type ImportableSignatureFile = SignatureFile | SignatureTemplate | unknown;

const scopeKey = (scope: SignatureEntry['scope']) =>
  scope.kind === 'subintent' ? `subintent:${scope.subintentId}` : scope.kind;

const requestIdentity = (input: {
  transactionId: string;
  scope: SignatureEntry['scope'];
  account: string | null;
  hash: SignatureEntry['hash'];
}) =>
  [
    input.transactionId,
    scopeKey(input.scope),
    input.account ?? '',
    input.hash.id ?? '',
    input.hash.hex,
  ].join('|');

const templateToSignatureEntry = (
  template: SignatureTemplate,
): SignatureEntry => ({
  scope: template.scope,
  account: template.account,
  hash: template.hash,
  signingRequestPath: template.signingRequestPath,
  publicKey: template.publicKey as SignatureEntry['publicKey'],
  signature: template.signature as SignatureEntry['signature'],
});

const decodeImportableFile = (file: ImportableSignatureFile) =>
  Effect.gen(function* () {
    if (typeof file !== 'object' || file === null || !('type' in file)) {
      return yield* new SignatureImportError({
        code: 'INVALID_SIGNATURE_FILE',
        reason: 'Workflow file type is missing',
      });
    }

    if (file.type === 'signatureTemplate') {
      const template = yield* Schema.decodeUnknown(SignatureTemplateSchema)(
        file,
      ).pipe(
        Effect.mapError(
          (reason) =>
            new SignatureImportError({
              code: 'INVALID_SIGNATURE_FILE',
              reason,
            }),
        ),
      );
      return {
        transactionId: template.transactionId,
        signatures: [templateToSignatureEntry(template)],
      };
    }

    if (file.type === 'batchSignatureFile') {
      const batch = yield* Schema.decodeUnknown(BatchSignatureFileSchema)(
        file,
      ).pipe(
        Effect.mapError(
          (reason) =>
            new SignatureImportError({
              code: 'INVALID_SIGNATURE_FILE',
              reason,
            }),
        ),
      );
      return {
        transactionId: null,
        signatures: batch.signatures.flatMap((item) => item.signatures),
      };
    }

    const signatureFile = yield* Schema.decodeUnknown(SignatureFileSchema)(
      file,
    ).pipe(
      Effect.mapError(
        (reason) =>
          new SignatureImportError({
            code: 'INVALID_SIGNATURE_FILE',
            reason,
          }),
      ),
    );
    return signatureFile;
  });

const rejectPlaceholders = (entry: SignatureEntry) => {
  if (entry.publicKey.hex === PLACEHOLDER_PUBLIC_KEY_HEX) {
    return new SignatureImportError({
      code: 'PLACEHOLDER_VALUE',
      reason: `publicKey.hex is still a placeholder for ${scopeKey(entry.scope)}${entry.signingRequestPath ? ` at ${entry.signingRequestPath}` : ''}`,
    });
  }

  if (entry.signature.hex === PLACEHOLDER_SIGNATURE_HEX) {
    return new SignatureImportError({
      code: 'PLACEHOLDER_VALUE',
      reason: `signature.hex is still a placeholder for ${scopeKey(entry.scope)}${entry.signingRequestPath ? ` at ${entry.signingRequestPath}` : ''}`,
    });
  }
};

const verifySignature = (entry: SignatureEntry) => {
  const verified = ed25519.verify(
    Buffer.from(entry.signature.hex, 'hex'),
    Buffer.from(entry.hash.hex, 'hex'),
    Buffer.from(entry.publicKey.hex, 'hex'),
  );

  if (!verified) {
    return new SignatureImportError({
      code: 'INVALID_SIGNATURE',
      reason: entry,
    });
  }
};

export const importSignatures = (input: {
  transactionId: string;
  generatedRequests: SigningRequest[];
  existing: readonly SignatureEntry[];
  files: ImportableSignatureFile[];
}): Effect.Effect<SignatureImportResult, SignatureImportError> =>
  Effect.gen(function* () {
    const knownRequests = new Set(
      input.generatedRequests.map((request) =>
        requestIdentity({
          transactionId: request.transactionId,
          scope: request.scope,
          account: request.account,
          hash: request.hash,
        }),
      ),
    );
    const imported: SignatureEntry[] = [];

    for (const file of input.files) {
      const decoded = yield* decodeImportableFile(file);

      if (
        decoded.transactionId &&
        decoded.transactionId !== input.transactionId
      ) {
        return yield* new SignatureImportError({
          code: 'UNKNOWN_SIGNING_REQUEST',
          reason: decoded.transactionId,
        });
      }

      for (const signature of decoded.signatures) {
        const placeholderError = rejectPlaceholders(signature);
        if (placeholderError) {
          return yield* placeholderError;
        }

        const identity = requestIdentity({
          transactionId: input.transactionId,
          scope: signature.scope,
          account: signature.account,
          hash: signature.hash,
        });

        if (!knownRequests.has(identity)) {
          return yield* new SignatureImportError({
            code: 'UNKNOWN_SIGNING_REQUEST',
            reason: identity,
          });
        }

        const verificationError = verifySignature(signature);
        if (verificationError) {
          return yield* verificationError;
        }

        imported.push(signature);
      }
    }

    return normalizeSignatures({
      transactionId: input.transactionId,
      existing: input.existing,
      imported,
    });
  });

export class SignatureImporter extends Effect.Service<SignatureImporter>()(
  'SignatureImporter',
  {
    sync: () => ({
      importSignatures,
    }),
  },
) {}
