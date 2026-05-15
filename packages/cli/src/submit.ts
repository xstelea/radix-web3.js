import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  Convert,
  PublicKey,
  RadixEngineToolkit,
  Signature,
  SignatureWithPublicKey,
  type TransactionIntentV2,
} from '@steleaio/radix-engine-toolkit';
import { Data, Effect, Schema } from 'effect';
import { findTransactionArtifact, writeSubmitResult } from './artifacts';
import type { ResolvedRdxConfig } from './config';
import {
  NetworkTransactionStatusSchema,
  PreparedTransactionSchema,
  type SignatureEntry,
  SignatureFileSchema,
  type SigningRequest,
  SigningRequestSchema,
  type SubmitResult,
  SubmitResultSchema,
} from './schemas';

export class SubmitError extends Data.TaggedError('SubmitError')<{
  code:
    | 'ALREADY_SUBMITTED'
    | 'MISSING_SIGNATURE'
    | 'MISSING_NOTARY_SIGNATURE'
    | 'READ_FAILED'
    | 'WRITE_FAILED';
  path?: string;
  reason?: unknown;
}> {}

export type SubmitTransactionResult = {
  transactionId: string;
  artifactPath: string;
  notarizedTransactionPath: string;
  submitResultPath: string;
  networkStatus: typeof NetworkTransactionStatusSchema.Type;
};

type StoredTransactionIntentV2 = {
  transactionHeader: {
    notaryPublicKey: string;
    notaryIsSignatory: boolean;
    tipBasisPoints: number;
  };
  rootIntentCore: StoredIntentCoreV2;
  nonRootSubintents: Array<{ intentCore: StoredIntentCoreV2 }>;
};

type StoredIntentCoreV2 = {
  header: TransactionIntentV2['rootIntentCore']['header'];
  instructions: string;
  blobs: [];
  message: TransactionIntentV2['rootIntentCore']['message'];
  children: string[];
};

type StoredTransactionIntentFile = {
  encoded: {
    kind: 'transactionIntentV2';
    value: StoredTransactionIntentV2;
  };
};

const readJson = (path: string) =>
  Effect.tryPromise({
    try: () => readFile(path, 'utf8').then(JSON.parse),
    catch: (reason) => new SubmitError({ code: 'READ_FAILED', path, reason }),
  });

const toTransactionIntent = (
  stored: StoredTransactionIntentV2,
): TransactionIntentV2 => ({
  transactionHeader: {
    notaryPublicKey: new PublicKey.Ed25519(
      stored.transactionHeader.notaryPublicKey,
    ),
    notaryIsSignatory: stored.transactionHeader.notaryIsSignatory,
    tipBasisPoints: stored.transactionHeader.tipBasisPoints,
  },
  rootIntentCore: {
    header: stored.rootIntentCore.header,
    instructions: stored.rootIntentCore.instructions,
    blobs: [],
    message: stored.rootIntentCore.message,
    children: stored.rootIntentCore.children.map(
      Convert.HexString.toUint8Array,
    ),
  },
  nonRootSubintents: stored.nonRootSubintents.map((subintent) => ({
    intentCore: {
      header: subintent.intentCore.header,
      instructions: subintent.intentCore.instructions,
      blobs: [],
      message: subintent.intentCore.message,
      children: subintent.intentCore.children.map(
        Convert.HexString.toUint8Array,
      ),
    },
  })),
});

const toSignatureWithPublicKey = (signature: SignatureEntry) =>
  new SignatureWithPublicKey.Ed25519(
    signature.signature.hex,
    signature.publicKey.hex,
  );

const rootIntentSignatures = (signatures: readonly SignatureEntry[]) =>
  signatures
    .filter(
      (signature) =>
        signature.scope.kind === 'rootIntent' ||
        signature.scope.kind === 'notarySignatory',
    )
    .map(toSignatureWithPublicKey);

const nonRootSubintentSignatures = (
  signatures: readonly SignatureEntry[],
  subintentOrder: readonly string[],
) =>
  subintentOrder.map((subintentId) =>
    signatures
      .filter(
        (signature) =>
          signature.scope.kind === 'subintent' &&
          signature.scope.subintentId === subintentId,
      )
      .map(toSignatureWithPublicKey),
  );

const findNotarySignature = (signatures: readonly SignatureEntry[]) =>
  signatures.find((signature) => signature.scope.kind === 'notary');

const readSigningRequest = (artifactPath: string, requestPath: string) =>
  readJson(join(artifactPath, requestPath)).pipe(
    Effect.flatMap(Schema.decodeUnknown(SigningRequestSchema)),
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

const readExistingSubmitResult = (artifactPath: string) =>
  readJson(join(artifactPath, 'submitResult.json')).pipe(
    Effect.flatMap(Schema.decodeUnknown(SubmitResultSchema)),
    Effect.catchAll(() => Effect.succeed(undefined)),
  );

const successfulSubmitStatuses = new Set(['CommittedSuccess']);

const isSuccessfulSubmitResult = (submitResult: SubmitResult | undefined) =>
  submitResult
    ? successfulSubmitStatuses.has(submitResult.networkStatus.status)
    : false;

const gatewayBaseUrl = (network: ResolvedRdxConfig['network']) =>
  network === 'stokenet'
    ? 'https://stokenet.radixdlt.com'
    : 'https://mainnet.radixdlt.com';

export const gatewaySubmitNotarizedTransaction = (input: {
  config: Pick<ResolvedRdxConfig, 'network' | 'gatewayBaseUrl'>;
  transactionId: string;
  notarizedTransactionHex: string;
}) =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(
        `${input.config.gatewayBaseUrl ?? gatewayBaseUrl(input.config.network)}/transaction/submit`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            notarized_transaction_hex: input.notarizedTransactionHex,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`Gateway submit failed with status ${response.status}`);
      }
      return NetworkTransactionStatusSchema.make({
        transactionId: input.transactionId,
        status: 'Submitted',
        statusDescription: 'Submitted to Gateway',
        errorMessage: null,
        checkedAt: new Date().toISOString(),
      });
    },
    catch: (reason) => new SubmitError({ code: 'WRITE_FAILED', reason }),
  });

export const submitTransactionArtifact = (input: {
  artifactRoot: string;
  transactionId: string;
  submitNotarizedTransaction: (
    notarizedTransactionHex: string,
  ) => Effect.Effect<typeof NetworkTransactionStatusSchema.Type, unknown>;
  pollTransactionStatus?: (
    transactionId: string,
  ) => Effect.Effect<typeof NetworkTransactionStatusSchema.Type, unknown>;
}): Effect.Effect<SubmitTransactionResult, unknown> =>
  Effect.gen(function* () {
    const artifactPath = yield* findTransactionArtifact(input);
    const existingSubmitResult = yield* readExistingSubmitResult(artifactPath);
    if (isSuccessfulSubmitResult(existingSubmitResult)) {
      return yield* new SubmitError({
        code: 'ALREADY_SUBMITTED',
        path: join(artifactPath, 'submitResult.json'),
      });
    }

    const prepared = yield* readJson(join(artifactPath, 'prepared.json')).pipe(
      Effect.flatMap(Schema.decodeUnknown(PreparedTransactionSchema)),
    );
    const storedIntentFile = yield* readJson(
      join(artifactPath, prepared.transactionIntentPath),
    ).pipe(Effect.map((value) => value as StoredTransactionIntentFile));
    const signatureFile = yield* readJson(
      join(artifactPath, 'signatures.json'),
    ).pipe(Effect.flatMap(Schema.decodeUnknown(SignatureFileSchema)));
    const generatedRequests = yield* Effect.all(
      prepared.signingRequests.map((requestPath) =>
        readSigningRequest(artifactPath, requestPath),
      ),
    );
    const missingRequest = generatedRequests.find(
      (request) => !requestComplete(request, signatureFile.signatures),
    );
    if (missingRequest) {
      return yield* new SubmitError({
        code: 'MISSING_SIGNATURE',
        path: missingRequest.signingRequestPath,
        reason: missingRequest,
      });
    }

    const notarySignatureEntry = findNotarySignature(signatureFile.signatures);
    if (!notarySignatureEntry) {
      return yield* new SubmitError({
        code: 'MISSING_NOTARY_SIGNATURE',
        path: join(artifactPath, 'signatures.json'),
      });
    }

    const transactionIntent = toTransactionIntent(
      storedIntentFile.encoded.value,
    );
    const signedTransactionIntent = {
      transactionIntent,
      transactionIntentSignatures: rootIntentSignatures(
        signatureFile.signatures,
      ),
      nonRootSubintentSignatures: nonRootSubintentSignatures(
        signatureFile.signatures,
        prepared.subintentOrder,
      ),
    };
    const notarizedTransaction = {
      signedTransactionIntent,
      notarySignature: new Signature.Ed25519(
        notarySignatureEntry.signature.hex,
      ),
    };
    const compiled = yield* Effect.tryPromise({
      try: () =>
        RadixEngineToolkit.NotarizedTransactionV2.compile(notarizedTransaction),
      catch: (reason) => new SubmitError({ code: 'WRITE_FAILED', reason }),
    });
    const notarizedTransactionHex = Convert.Uint8Array.toHexString(compiled);
    const notarizedTransactionPath = join(
      artifactPath,
      'notarizedTransaction.hex',
    );
    yield* Effect.tryPromise({
      try: () =>
        writeFile(
          notarizedTransactionPath,
          `${notarizedTransactionHex}\n`,
          'utf8',
        ),
      catch: (reason) =>
        new SubmitError({
          code: 'WRITE_FAILED',
          path: notarizedTransactionPath,
          reason,
        }),
    });

    const submittedStatus = yield* input.submitNotarizedTransaction(
      notarizedTransactionHex,
    );
    const networkStatus = input.pollTransactionStatus
      ? yield* input.pollTransactionStatus(prepared.transactionId)
      : submittedStatus;
    const newAttempts = input.pollTransactionStatus
      ? [
          {
            checkedAt: submittedStatus.checkedAt,
            status: submittedStatus.status,
            statusDescription: submittedStatus.statusDescription,
            errorMessage: submittedStatus.errorMessage,
          },
          {
            checkedAt: networkStatus.checkedAt,
            status: networkStatus.status,
            statusDescription: networkStatus.statusDescription,
            errorMessage: networkStatus.errorMessage,
          },
        ]
      : [
          {
            checkedAt: networkStatus.checkedAt,
            status: networkStatus.status,
            statusDescription: networkStatus.statusDescription,
            errorMessage: networkStatus.errorMessage,
          },
        ];
    const submitResult: SubmitResult = {
      type: 'submitResult',
      version: 1,
      transactionId: prepared.transactionId,
      networkStatus,
      attempts: [...(existingSubmitResult?.attempts ?? []), ...newAttempts],
    };
    const submitResultPath = yield* writeSubmitResult({
      artifactPath,
      submitResult,
    });

    return {
      transactionId: prepared.transactionId,
      artifactPath,
      notarizedTransactionPath,
      submitResultPath,
      networkStatus,
    };
  });

export class SubmitLifecycle extends Effect.Service<SubmitLifecycle>()(
  'SubmitLifecycle',
  {
    sync: () => ({
      submitTransactionArtifact,
      gatewaySubmitNotarizedTransaction,
    }),
  },
) {}
