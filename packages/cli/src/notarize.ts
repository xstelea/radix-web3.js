import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  Convert,
  PublicKey,
  RadixEngineToolkit,
  SignatureWithPublicKey,
  type TransactionIntentV2,
  TransactionV2Builder,
} from '@steleaio/radix-engine-toolkit';
import { Data, Effect, Schema } from 'effect';
import { findTransactionArtifact } from './artifacts';
import type { ResolvedRdxConfig } from './config';
import {
  PLACEHOLDER_SIGNATURE_HEX,
  PreparedTransactionSchema,
  type SignatureEntry,
  SignatureFileSchema,
  type SignatureTemplate,
  type SigningRequest,
  SigningRequestSchema,
} from './schemas';

export class NotarizeError extends Data.TaggedError('NotarizeError')<{
  code:
    | 'INCOMPLETE_SIGNATURES'
    | 'MISSING_NOTARY_PUBLIC_KEY'
    | 'PREVIEW_FAILED'
    | 'READ_FAILED'
    | 'WRITE_FAILED';
  path?: string;
  reason?: unknown;
}> {}

export type NotarizeTransactionResult = {
  transactionId: string;
  artifactPath: string;
  signedTransactionIntentPath: string;
  notarySigningRequestPath: string;
  notarySignatureTemplatePath: string;
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
    catch: (reason) => new NotarizeError({ code: 'READ_FAILED', path, reason }),
  });

const writeJson = (path: string, value: unknown) =>
  Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () => mkdir(dirname(path), { recursive: true }),
      catch: (reason) =>
        new NotarizeError({ code: 'WRITE_FAILED', path, reason }),
    });
    yield* Effect.tryPromise({
      try: () => writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'),
      catch: (reason) =>
        new NotarizeError({ code: 'WRITE_FAILED', path, reason }),
    });
  });

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

const rootSignerPublicKeys = (signatures: readonly SignatureEntry[]) =>
  signatures
    .filter(
      (signature) =>
        signature.scope.kind === 'rootIntent' ||
        signature.scope.kind === 'notarySignatory',
    )
    .map((signature) => new PublicKey.Ed25519(signature.publicKey.hex));

const nonRootSignerPublicKeys = (
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
      .map((signature) => new PublicKey.Ed25519(signature.publicKey.hex)),
  );

const buildNotarizePreviewHex = (input: {
  transactionIntent: TransactionIntentV2;
  signatures: readonly SignatureEntry[];
  subintentOrder: readonly string[];
}) =>
  Effect.gen(function* () {
    const builder = yield* Effect.tryPromise(() => TransactionV2Builder.new());
    let builderStep = builder
      .header(input.transactionIntent.transactionHeader)
      .rootIntentCore(input.transactionIntent.rootIntentCore);
    const subintentSignatures = nonRootSubintentSignatures(
      input.signatures,
      input.subintentOrder,
    );

    for (
      let index = 0;
      index < input.transactionIntent.nonRootSubintents.length;
      index += 1
    ) {
      builderStep = builderStep.addSignedSubintent(
        input.transactionIntent.nonRootSubintents[index],
        subintentSignatures[index] ?? [],
      );
    }

    const previewTransaction = builderStep.buildPreviewTransaction({
      rootSignerPublicKeys: rootSignerPublicKeys(input.signatures),
      nonRootSubintentSignerPublicKeys: nonRootSignerPublicKeys(
        input.signatures,
        input.subintentOrder,
      ),
    });
    const compiled = yield* Effect.tryPromise(() =>
      RadixEngineToolkit.PreviewTransactionV2.compile(previewTransaction),
    );
    return Convert.Uint8Array.toHexString(compiled);
  });

const gatewayBaseUrl = (network: ResolvedRdxConfig['network']) =>
  network === 'stokenet'
    ? 'https://stokenet.radixdlt.com'
    : 'https://mainnet.radixdlt.com';

export const gatewayNotarizePreview = (input: {
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
              assume_all_signature_proofs: false,
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
          `Gateway preview failed with status ${response.status}`,
        );
      }
      const body = (await response.json()) as {
        receipt?: { status?: string; error_message?: string };
      };
      if (body.receipt && body.receipt.status !== 'Succeeded') {
        throw new Error(body.receipt.error_message ?? 'Preview failed');
      }
    },
    catch: (reason) => new NotarizeError({ code: 'PREVIEW_FAILED', reason }),
  });

export const notarizeTransactionArtifact = (input: {
  artifactRoot: string;
  transactionId: string;
  previewSignedTransactionIntent?: (
    previewTransactionHex: string,
  ) => Effect.Effect<void, unknown>;
}): Effect.Effect<NotarizeTransactionResult, unknown> =>
  Effect.gen(function* () {
    const artifactPath = yield* findTransactionArtifact(input);
    const preparedPath = join(artifactPath, 'prepared.json');
    const prepared = yield* readJson(preparedPath).pipe(
      Effect.flatMap(Schema.decodeUnknown(PreparedTransactionSchema)),
    );

    if (!prepared.notaryPublicKey) {
      return yield* new NotarizeError({
        code: 'MISSING_NOTARY_PUBLIC_KEY',
        path: preparedPath,
      });
    }

    const generatedRequests = yield* Effect.all(
      prepared.signingRequests.map((requestPath) =>
        readJson(join(artifactPath, requestPath)).pipe(
          Effect.flatMap(Schema.decodeUnknown(SigningRequestSchema)),
        ),
      ),
    );
    const signatureFile = yield* readJson(
      join(artifactPath, 'signatures.json'),
    ).pipe(Effect.flatMap(Schema.decodeUnknown(SignatureFileSchema)));

    const complete = generatedRequests.every((request) =>
      requestComplete(request, signatureFile.signatures),
    );
    if (!complete) {
      return yield* new NotarizeError({
        code: 'INCOMPLETE_SIGNATURES',
        path: join(artifactPath, 'signatures.json'),
      });
    }

    const storedIntentFile = yield* readJson(
      join(artifactPath, prepared.transactionIntentPath),
    ).pipe(Effect.map((value) => value as StoredTransactionIntentFile));
    const transactionIntent = toTransactionIntent(
      storedIntentFile.encoded.value,
    );
    const signedIntent = {
      transactionIntent,
      transactionIntentSignatures: rootIntentSignatures(
        signatureFile.signatures,
      ),
      nonRootSubintentSignatures: nonRootSubintentSignatures(
        signatureFile.signatures,
        prepared.subintentOrder,
      ),
    };
    const signedIntentHash = yield* Effect.tryPromise({
      try: () =>
        RadixEngineToolkit.SignedTransactionIntentV2.hash(signedIntent),
      catch: (reason) =>
        new NotarizeError({
          code: 'READ_FAILED',
          path: prepared.transactionIntentPath,
          reason,
        }),
    });
    const signedIntentCompiled = yield* Effect.tryPromise({
      try: () =>
        RadixEngineToolkit.SignedTransactionIntentV2.compile(signedIntent),
      catch: (reason) =>
        new NotarizeError({
          code: 'READ_FAILED',
          path: prepared.transactionIntentPath,
          reason,
        }),
    });
    if (input.previewSignedTransactionIntent) {
      const previewTransactionHex = yield* buildNotarizePreviewHex({
        transactionIntent,
        signatures: signatureFile.signatures,
        subintentOrder: prepared.subintentOrder,
      });
      yield* input.previewSignedTransactionIntent(previewTransactionHex);
    }

    const hash = {
      id: signedIntentHash.id,
      hex: Convert.Uint8Array.toHexString(signedIntentHash.hash),
    };
    const requestPath = 'signing-requests/notary.json';
    const templatePath = 'signature-templates/notary.json';
    const request: SigningRequest = {
      type: 'signingRequest',
      version: 1,
      transactionId: prepared.transactionId,
      scope: { kind: 'notary' },
      account: null,
      hash,
      signingRequestPath: requestPath,
    };
    const template: SignatureTemplate = {
      type: 'signatureTemplate',
      version: 1,
      transactionId: prepared.transactionId,
      scope: { kind: 'notary' },
      account: null,
      hash,
      signingRequestPath: requestPath,
      publicKey: prepared.notaryPublicKey,
      signature: {
        curve: 'Ed25519',
        hex: PLACEHOLDER_SIGNATURE_HEX,
      },
    };

    const notarySigningRequestPath = join(artifactPath, requestPath);
    const notarySignatureTemplatePath = join(artifactPath, templatePath);
    const signedTransactionIntentPath = join(
      artifactPath,
      'signedTransactionIntent.json',
    );
    yield* writeJson(signedTransactionIntentPath, {
      type: 'signedTransactionIntent',
      version: 1,
      transactionId: prepared.transactionId,
      encoded: {
        kind: 'signedTransactionIntentV2',
        compiledHex: Convert.Uint8Array.toHexString(signedIntentCompiled),
      },
    });
    yield* writeJson(notarySigningRequestPath, request);
    yield* writeJson(notarySignatureTemplatePath, template);
    yield* writeJson(preparedPath, {
      ...prepared,
      signingRequests: [...new Set([...prepared.signingRequests, requestPath])],
      signatureTemplates: [
        ...new Set([...prepared.signatureTemplates, templatePath]),
      ],
    });

    return {
      transactionId: prepared.transactionId,
      artifactPath,
      signedTransactionIntentPath,
      notarySigningRequestPath,
      notarySignatureTemplatePath,
    };
  });

export class NotarizationCoordinator extends Effect.Service<NotarizationCoordinator>()(
  'NotarizationCoordinator',
  {
    sync: () => ({
      notarizeTransactionArtifact,
      gatewayNotarizePreview,
    }),
  },
) {}
