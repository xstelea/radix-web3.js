import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { it } from '@effect/vitest';
import { Effect, Schema } from 'effect';
import { describe, expect } from 'vitest';
import {
  createTransactionArtifactDirectory,
  findTransactionArtifact,
  listTransactionArtifacts,
  normalizeSignatures,
  writeCanonicalSignatures,
} from './artifacts';
import { type SignatureEntry, SignatureFileSchema } from './schemas';
import { makeTempDir } from './test-helpers';

const publicKey =
  '1111111111111111111111111111111111111111111111111111111111111111';
const otherPublicKey =
  '3333333333333333333333333333333333333333333333333333333333333333';
const signature =
  '22222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222';
const otherSignature =
  '44444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444';

const entry = (input: Partial<SignatureEntry> = {}): SignatureEntry => ({
  scope: { kind: 'rootIntent' },
  account: 'account_rdx1...',
  hash: { id: 'intent', hex: 'aa' },
  publicKey: { curve: 'Ed25519', hex: publicKey },
  signature: { curve: 'Ed25519', hex: signature },
  ...input,
});

describe('artifact store', () => {
  it.effect(
    'creates deterministic transaction directories without overwrite',
    () =>
      Effect.gen(function* () {
        const artifactRoot = yield* makeTempDir('artifact-root');
        const first = yield* createTransactionArtifactDirectory({
          artifactRoot,
          transactionId: 'txid_123',
        });

        expect(first).toBe(join(artifactRoot, 'txid_123'));

        const second = yield* Effect.exit(
          createTransactionArtifactDirectory({
            artifactRoot,
            transactionId: 'txid_123',
          }),
        );

        expect(second._tag).toBe('Failure');
      }),
  );

  it.effect('normalizes duplicate and sorted canonical signatures', () =>
    Effect.sync(() => {
      const result = normalizeSignatures({
        transactionId: 'txid',
        existing: [],
        imported: [
          entry({
            scope: { kind: 'notary' },
            account: null,
            publicKey: { curve: 'Ed25519', hex: otherPublicKey },
          }),
          entry(),
          entry(),
          entry({ signature: { curve: 'Ed25519', hex: otherSignature } }),
        ],
      });

      expect(result.acceptedCount).toBe(2);
      expect(result.warnings).toHaveLength(1);
      expect(
        result.signatureFile.signatures.map((item) => item.scope.kind),
      ).toEqual(['rootIntent', 'notary']);
    }),
  );

  it.effect('writes canonical signatures.json', () =>
    Effect.gen(function* () {
      const artifactRoot = yield* makeTempDir('canonical-signatures');
      const artifactPath = join(artifactRoot, 'txid');
      yield* Effect.promise(() => mkdir(artifactPath, { recursive: true }));

      const filePath = yield* writeCanonicalSignatures({
        artifactPath,
        transactionId: 'txid',
        existing: [],
        imported: [entry()],
      });

      const file = yield* Effect.promise(() => readFile(filePath, 'utf8'));
      const parsed = Schema.decodeUnknownSync(SignatureFileSchema)(
        JSON.parse(file),
      );

      expect(parsed).toMatchObject({
        type: 'signatureFile',
        version: 1,
        transactionId: 'txid',
      });
      expect(parsed.signatures).toHaveLength(1);
    }),
  );

  it.effect('finds an artifact path by transaction ID', () =>
    Effect.gen(function* () {
      const artifactRoot = yield* makeTempDir('path');
      const artifactPath = join(artifactRoot, 'txid');
      yield* writePreparedArtifact({
        artifactPath,
        transactionId: 'txid',
        network: 'mainnet',
        intentHash: 'intent_txid',
        manifestSourceFile: 'root.rtm',
      });

      const result = yield* findTransactionArtifact({
        artifactRoot,
        transactionId: 'txid',
      });

      expect(result).toBe(artifactPath);
    }),
  );

  it.effect('lists artifacts with pattern and exact filters', () =>
    Effect.gen(function* () {
      const artifactRoot = yield* makeTempDir('list');
      yield* writePreparedArtifact({
        artifactPath: join(artifactRoot, 'txid_1'),
        transactionId: 'txid_1',
        network: 'mainnet',
        intentHash: 'intent_alpha',
        manifestSourceFile: 'alpha.rtm',
      });
      yield* writePreparedArtifact({
        artifactPath: join(artifactRoot, 'txid_2'),
        transactionId: 'txid_2',
        network: 'stokenet',
        intentHash: 'intent_beta',
        manifestSourceFile: 'beta.rtm',
      });
      yield* Effect.promise(() =>
        writeFile(
          join(artifactRoot, 'txid_2', 'submitResult.json'),
          '{}',
          'utf8',
        ),
      );

      const patternResult = yield* listTransactionArtifacts({
        artifactRoot,
        pattern: 'alpha',
      });
      expect(patternResult.map((item) => item.transactionId)).toEqual([
        'txid_1',
      ]);

      const filteredResult = yield* listTransactionArtifacts({
        artifactRoot,
        network: 'stokenet',
        status: 'submitted',
      });
      expect(filteredResult).toMatchObject([
        {
          transactionId: 'txid_2',
          status: 'submitted',
          network: 'stokenet',
        },
      ]);
    }),
  );
});

const writePreparedArtifact = (input: {
  artifactPath: string;
  transactionId: string;
  network: 'mainnet' | 'stokenet';
  intentHash: string;
  manifestSourceFile: string;
}) =>
  Effect.promise(async () => {
    await mkdir(input.artifactPath, { recursive: true });
    await writeFile(
      join(input.artifactPath, 'prepared.json'),
      JSON.stringify(
        {
          type: 'preparedTransaction',
          version: 1,
          transactionId: input.transactionId,
          network: input.network,
          intentHash: { id: input.intentHash, hex: 'aa' },
          manifestSourceFile: input.manifestSourceFile,
          transactionIntentPath: 'transactionIntent.json',
          staticAnalysisPath: 'staticAnalysis.json',
          signingRequests: [],
          signatureTemplates: [],
          subintentOrder: [],
          authorizationAnalysis: { rootIntent: [], subintents: {} },
        },
        null,
        2,
      ),
      'utf8',
    );
  });
