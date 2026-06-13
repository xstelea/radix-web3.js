import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { assert, describe, it } from '@effect/vitest';
import { Effect, Schema } from 'effect';

import {
  ArtifactStoreError,
  createTransactionArtifactDirectory,
  findTransactionArtifact,
  listTransactionArtifacts,
  normalizeSignatures,
  writeCanonicalSignatures,
} from './artifacts';
import {
  NetworkSchema,
  type SignatureEntry,
  SignatureFileSchema,
} from './schemas';
import { makeTempDir } from './test-helpers';

const publicKey =
  '1111111111111111111111111111111111111111111111111111111111111111';
const otherPublicKey =
  '3333333333333333333333333333333333333333333333333333333333333333';
const signature =
  '22222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222';
const otherSignature =
  '44444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444';

const stokenet = NetworkSchema.make('stokenet');

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

        assert.strictEqual(first, join(artifactRoot, 'txid_123'));

        const second = yield* Effect.result(
          createTransactionArtifactDirectory({
            artifactRoot,
            transactionId: 'txid_123',
          }),
        );

        assert.strictEqual(second._tag, 'Failure');
        if (second._tag === 'Failure') {
          assert.instanceOf(second.failure, ArtifactStoreError);
          assert.strictEqual(second.failure.path, first);
        }
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

      assert.strictEqual(result.acceptedCount, 2);
      assert.lengthOf(result.warnings, 1);
      assert.deepEqual(
        result.signatureFile.signatures.map((item) => item.scope.kind),
        ['rootIntent', 'notary'],
      );
    }),
  );

  it.effect('writes canonical signatures.json', () =>
    Effect.gen(function* () {
      const artifactRoot = yield* makeTempDir('canonical-signatures');
      const artifactPath = join(artifactRoot, 'txid');
      yield* Effect.tryPromise(() => mkdir(artifactPath, { recursive: true }));

      const filePath = yield* writeCanonicalSignatures({
        artifactPath,
        transactionId: 'txid',
        existing: [],
        imported: [entry()],
      });

      const file = yield* Effect.tryPromise(() => readFile(filePath, 'utf8'));
      const parsed = Schema.decodeUnknownSync(SignatureFileSchema)(
        JSON.parse(file),
      );

      assert.strictEqual(parsed.type, 'signatureFile');
      assert.strictEqual(parsed.version, 1);
      assert.strictEqual(parsed.transactionId, 'txid');
      assert.lengthOf(parsed.signatures, 1);
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

      assert.strictEqual(result, artifactPath);
    }),
  );

  it.effect('fails with a typed artifact error when no artifact exists', () =>
    Effect.gen(function* () {
      const artifactRoot = yield* makeTempDir('missing-artifact');
      const result = yield* Effect.result(
        findTransactionArtifact({
          artifactRoot,
          transactionId: 'txid_missing',
        }),
      );

      assert.strictEqual(result._tag, 'Failure');
      if (result._tag === 'Failure') {
        assert.instanceOf(result.failure, ArtifactStoreError);
        assert.strictEqual(
          result.failure.path,
          join(artifactRoot, 'txid_missing'),
        );
        assert.strictEqual(
          result.failure.reason,
          'Transaction artifact not found',
        );
      }
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
        network: stokenet,
        intentHash: 'intent_beta',
        manifestSourceFile: 'beta.rtm',
      });
      yield* Effect.tryPromise(() =>
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
      assert.deepEqual(
        patternResult.map((item) => item.transactionId),
        ['txid_1'],
      );

      const filteredResult = yield* listTransactionArtifacts({
        artifactRoot,
        network: stokenet,
        status: 'submitted',
      });
      assert.lengthOf(filteredResult, 1);
      assert.strictEqual(filteredResult[0].transactionId, 'txid_2');
      assert.strictEqual(filteredResult[0].status, 'submitted');
      assert.strictEqual(filteredResult[0].network, stokenet);
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
  Effect.tryPromise(async () => {
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
