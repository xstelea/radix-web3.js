import {
  access,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { Data, Effect, Schema } from 'effect';
import {
  type ArtifactStatus,
  type NetworkTransactionStatus,
  type PreparedTransaction,
  PreparedTransactionSchema,
  type SignatureEntry,
  type SignatureFile,
  type SigningScope,
  type SubmitResult,
} from './schemas';

export class ArtifactStoreError extends Data.TaggedError('ArtifactStoreError')<{
  path: string;
  reason: unknown;
}> {}

export type SignatureImportResult = {
  signatureFile: SignatureFile;
  acceptedCount: number;
  warnings: string[];
};

export type TransactionArtifactSummary = {
  transactionId: string;
  path: string;
  network: PreparedTransaction['network'];
  status: ArtifactStatus;
  intentHash: string;
  manifestSourceFile: string;
  networkStatus?: NetworkTransactionStatus;
  updatedSubmitResultPath?: string | null;
};

const scopeSortKey = (scope: SigningScope) => {
  switch (scope.kind) {
    case 'rootIntent':
      return '0:root';
    case 'subintent':
      return `1:${scope.subintentId}`;
    case 'notarySignatory':
      return '2:notarySignatory';
    case 'notary':
      return '3:notary';
  }
};

const signatureIdentity = (entry: SignatureEntry) =>
  [
    scopeSortKey(entry.scope),
    entry.account ?? '',
    entry.hash.id ?? '',
    entry.hash.hex,
    entry.publicKey.curve,
    entry.publicKey.hex,
  ].join('|');

const sortSignature = (left: SignatureEntry, right: SignatureEntry) =>
  signatureIdentity(left).localeCompare(signatureIdentity(right));

export const normalizeSignatures = (input: {
  transactionId: string;
  existing: readonly SignatureEntry[];
  imported: readonly SignatureEntry[];
}): SignatureImportResult => {
  const byIdentity = new Map<string, SignatureEntry>();
  const warnings: string[] = [];
  let acceptedCount = 0;

  for (const signature of [...input.existing, ...input.imported]) {
    const identity = signatureIdentity(signature);
    const existing = byIdentity.get(identity);

    if (!existing) {
      byIdentity.set(identity, signature);
      if (input.imported.includes(signature)) {
        acceptedCount += 1;
      }
      continue;
    }

    if (existing.signature.hex !== signature.signature.hex) {
      warnings.push(`Ignored differing duplicate signature for ${identity}`);
    }
  }

  return {
    signatureFile: {
      type: 'signatureFile',
      version: 1,
      transactionId: input.transactionId,
      signatures: [...byIdentity.values()].sort(sortSignature),
    },
    acceptedCount,
    warnings,
  };
};

export const createTransactionArtifactDirectory = (input: {
  artifactRoot: string;
  transactionId: string;
}): Effect.Effect<string, ArtifactStoreError> =>
  Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () => mkdir(input.artifactRoot, { recursive: true }),
      catch: (reason) =>
        new ArtifactStoreError({ path: input.artifactRoot, reason }),
    });

    const artifactPath = join(input.artifactRoot, input.transactionId);
    yield* Effect.tryPromise({
      try: () => mkdir(artifactPath),
      catch: (reason) => new ArtifactStoreError({ path: artifactPath, reason }),
    });

    return artifactPath;
  });

export const writeCanonicalSignatures = (input: {
  artifactPath: string;
  transactionId: string;
  existing: readonly SignatureEntry[];
  imported: readonly SignatureEntry[];
}): Effect.Effect<string, ArtifactStoreError> => {
  const result = normalizeSignatures(input);
  const path = join(input.artifactPath, 'signatures.json');

  return Effect.tryPromise({
    try: () =>
      writeFile(
        path,
        `${JSON.stringify(result.signatureFile, null, 2)}\n`,
        'utf8',
      ),
    catch: (reason) => new ArtifactStoreError({ path, reason }),
  }).pipe(Effect.as(path));
};

export const writeSubmitResult = (input: {
  artifactPath: string;
  submitResult: SubmitResult;
}): Effect.Effect<string, ArtifactStoreError> => {
  const path = join(input.artifactPath, 'submitResult.json');

  return Effect.tryPromise({
    try: () =>
      writeFile(
        path,
        `${JSON.stringify(input.submitResult, null, 2)}\n`,
        'utf8',
      ),
    catch: (reason) => new ArtifactStoreError({ path, reason }),
  }).pipe(Effect.as(path));
};

const pathExists = (path: string) =>
  Effect.promise(() =>
    access(path)
      .then(() => true)
      .catch(() => false),
  );

const readPreparedTransaction = (path: string) =>
  Effect.tryPromise({
    try: () => readFile(path, 'utf8').then(JSON.parse),
    catch: (reason) => new ArtifactStoreError({ path, reason }),
  }).pipe(
    Effect.flatMap((value) =>
      Schema.decodeUnknown(PreparedTransactionSchema)(value).pipe(
        Effect.mapError((reason) => new ArtifactStoreError({ path, reason })),
      ),
    ),
  );

const getArtifactStatus = (artifactPath: string) =>
  Effect.gen(function* () {
    if (yield* pathExists(join(artifactPath, 'submitResult.json'))) {
      return 'submitted' as const;
    }

    if (yield* pathExists(join(artifactPath, 'notarizedTransaction.hex'))) {
      return 'notarized' as const;
    }

    return 'prepared' as const;
  });

const readArtifactSummary = (
  artifactPath: string,
): Effect.Effect<TransactionArtifactSummary, ArtifactStoreError> =>
  Effect.gen(function* () {
    const prepared = yield* readPreparedTransaction(
      join(artifactPath, 'prepared.json'),
    );
    const status = yield* getArtifactStatus(artifactPath);

    return {
      transactionId: prepared.transactionId,
      path: artifactPath,
      network: prepared.network,
      status,
      intentHash: prepared.intentHash.id ?? prepared.intentHash.hex,
      manifestSourceFile: prepared.manifestSourceFile,
    };
  });

export const findTransactionArtifact = (input: {
  artifactRoot: string;
  transactionId: string;
}): Effect.Effect<string, ArtifactStoreError> =>
  Effect.gen(function* () {
    const artifactPath = join(input.artifactRoot, input.transactionId);
    const exists = yield* pathExists(join(artifactPath, 'prepared.json'));

    if (!exists) {
      return yield* new ArtifactStoreError({
        path: artifactPath,
        reason: 'Transaction artifact not found',
      });
    }

    return artifactPath;
  });

export const findTransactionArtifactOption = (input: {
  artifactRoot: string;
  transactionId: string;
}): Effect.Effect<string | undefined> =>
  Effect.gen(function* () {
    const artifactPath = join(input.artifactRoot, input.transactionId);
    const exists = yield* pathExists(join(artifactPath, 'prepared.json'));
    return exists ? artifactPath : undefined;
  });

export const listTransactionArtifacts = (input: {
  artifactRoot: string;
  pattern?: string;
  regex?: string;
  network?: PreparedTransaction['network'];
  status?: ArtifactStatus;
}): Effect.Effect<TransactionArtifactSummary[], ArtifactStoreError> =>
  Effect.gen(function* () {
    const rootExists = yield* pathExists(input.artifactRoot);
    if (!rootExists) {
      return [];
    }

    const entries = yield* Effect.tryPromise({
      try: () => readdir(input.artifactRoot),
      catch: (reason) =>
        new ArtifactStoreError({ path: input.artifactRoot, reason }),
    });
    const regex = input.regex ? new RegExp(input.regex) : undefined;
    const pattern = input.pattern?.toLowerCase();
    const summaries: TransactionArtifactSummary[] = [];

    for (const entry of entries) {
      const artifactPath = join(input.artifactRoot, entry);
      const entryStat = yield* Effect.tryPromise({
        try: () => stat(artifactPath),
        catch: (reason) =>
          new ArtifactStoreError({ path: artifactPath, reason }),
      });

      if (!entryStat.isDirectory()) {
        continue;
      }

      const summary = yield* readArtifactSummary(artifactPath);
      const searchable = [
        summary.transactionId,
        summary.intentHash,
        summary.manifestSourceFile,
      ];

      if (input.network && summary.network !== input.network) {
        continue;
      }

      if (input.status && summary.status !== input.status) {
        continue;
      }

      if (
        pattern &&
        !searchable.some((value) => value.toLowerCase().includes(pattern))
      ) {
        continue;
      }

      if (regex && !searchable.some((value) => regex.test(value))) {
        continue;
      }

      summaries.push(summary);
    }

    return summaries.sort((left, right) =>
      left.transactionId.localeCompare(right.transactionId),
    );
  });

export class ArtifactStore extends Effect.Service<ArtifactStore>()(
  'ArtifactStore',
  {
    sync: () => ({
      createTransactionArtifactDirectory,
      findTransactionArtifactOption,
      findTransactionArtifact,
      listTransactionArtifacts,
      writeSubmitResult,
      writeCanonicalSignatures,
    }),
  },
) {}
