import { access, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, assert, describe, it, vi } from '@effect/vitest';
import { Effect, Schema } from 'effect';

import {
  gatewayCurrentEpoch,
  gatewayPreparePreview,
  prepareTransactionArtifacts,
} from './prepare';
import {
  NetworkSchema,
  PreparedTransactionSchema,
  SignatureTemplateSchema,
  SigningRequestSchema,
} from './schemas';
import { makeTempDir } from './test-helpers';

const notaryPublicKey = {
  curve: 'Ed25519' as const,
  hex: '1111111111111111111111111111111111111111111111111111111111111111',
};
const stokenet = NetworkSchema.make('stokenet');
const stokenetFaucetManifest =
  'CALL_METHOD Address("component_tdx_2_1cptxxxxxxxxxfaucetxxxxxxxxx000527798379xxxxxxxxxyulkzl") "lock_fee" Decimal("10"); CALL_METHOD Address("component_tdx_2_1cptxxxxxxxxxfaucetxxxxxxxxx000527798379xxxxxxxxxyulkzl") "free";';

describe('tx prepare workflow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.effect('fails prepare preview when the gateway receipt fails', () =>
    Effect.gen(function* () {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            receipt: {
              status: 'Failed',
              error_message: 'manifest rejected',
            },
          }),
          { status: 200 },
        ),
      );

      const result = yield* Effect.result(
        gatewayPreparePreview({
          config: { network: stokenet },
          previewTransactionHex: 'aa',
        }),
      );

      assert.strictEqual(result._tag, 'Failure');
      if (result._tag === 'Failure') {
        assert.strictEqual(result.failure._tag, 'PreparePreviewError');
      }
    }),
  );

  it.effect('rejects malformed gateway epoch responses', () =>
    Effect.gen(function* () {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ ledger_state: { epoch: '12' } }), {
          status: 200,
        }),
      );

      const result = yield* Effect.result(
        gatewayCurrentEpoch({
          config: { network: stokenet },
        }),
      );

      assert.strictEqual(result._tag, 'Failure');
      if (result._tag === 'Failure') {
        assert.strictEqual(result.failure._tag, 'PreparePreviewError');
      }
    }),
  );

  it.effect('writes durable prepared transaction artifacts', () =>
    Effect.gen(function* () {
      const cwd = yield* makeTempDir('prepare-cwd');
      const artifactRoot = join(cwd, '.rdx', 'transactions');
      const manifestPath = join(cwd, 'root.rtm');
      yield* Effect.tryPromise(() =>
        writeFile(manifestPath, stokenetFaucetManifest, 'utf8'),
      );

      const result = yield* prepareTransactionArtifacts({
        artifactRoot,
        network: stokenet,
        manifestPath,
        notary: {
          publicKey: notaryPublicKey,
          notaryIsSignatory: true,
        },
      });

      assert.match(result.transactionId, /^txid_tdx_2_/);
      assert.strictEqual(
        result.preparedPath,
        join(result.artifactPath, 'prepared.json'),
      );
      assert.include(
        result.signatureTemplatePaths,
        join(result.artifactPath, 'signature-templates/notary-signatory.json'),
      );

      const prepared = Schema.decodeUnknownSync(PreparedTransactionSchema)(
        JSON.parse(
          yield* Effect.tryPromise(() => readFile(result.preparedPath, 'utf8')),
        ),
      );
      assert.deepInclude(prepared, {
        type: 'preparedTransaction',
        transactionId: result.transactionId,
        network: stokenet,
        transactionIntentPath: 'transactionIntent.json',
        staticAnalysisPath: 'staticAnalysis.json',
        notaryPublicKey,
      });
      assert.deepEqual(prepared.authorizationAnalysis.rootIntent, []);
      assert.deepEqual(prepared.authorizationAnalysis.subintents, {});

      const request = Schema.decodeUnknownSync(SigningRequestSchema)(
        JSON.parse(
          yield* Effect.tryPromise(() =>
            readFile(
              join(
                result.artifactPath,
                'signing-requests/notary-signatory.json',
              ),
              'utf8',
            ),
          ),
        ),
      );
      assert.deepEqual(request.scope, { kind: 'notarySignatory' });

      const template = Schema.decodeUnknownSync(SignatureTemplateSchema)(
        JSON.parse(
          yield* Effect.tryPromise(() =>
            readFile(
              join(
                result.artifactPath,
                'signature-templates/notary-signatory.json',
              ),
              'utf8',
            ),
          ),
        ),
      );
      assert.deepEqual(template.publicKey, notaryPublicKey);
    }),
  );

  it.effect('fails rather than overwriting existing artifacts', () =>
    Effect.gen(function* () {
      const cwd = yield* makeTempDir('prepare-overwrite');
      const artifactRoot = join(cwd, '.rdx', 'transactions');
      const manifestPath = join(cwd, 'root.rtm');
      yield* Effect.tryPromise(() =>
        writeFile(manifestPath, stokenetFaucetManifest, 'utf8'),
      );

      yield* prepareTransactionArtifacts({
        artifactRoot,
        network: stokenet,
        manifestPath,
        notary: {
          publicKey: notaryPublicKey,
          notaryIsSignatory: false,
        },
      });

      const result = yield* Effect.exit(
        prepareTransactionArtifacts({
          artifactRoot,
          network: stokenet,
          manifestPath,
          notary: {
            publicKey: notaryPublicKey,
            notaryIsSignatory: false,
          },
        }),
      );

      assert.strictEqual(result._tag, 'Failure');
    }),
  );

  it.effect('blocks artifact creation when prepare preview fails', () =>
    Effect.gen(function* () {
      const cwd = yield* makeTempDir('prepare-preview-fails');
      const artifactRoot = join(cwd, '.rdx', 'transactions');
      const manifestPath = join(cwd, 'root.rtm');
      yield* Effect.tryPromise(() =>
        writeFile(manifestPath, stokenetFaucetManifest, 'utf8'),
      );

      const result = yield* Effect.result(
        prepareTransactionArtifacts({
          artifactRoot,
          network: stokenet,
          manifestPath,
          notary: {
            publicKey: notaryPublicKey,
            notaryIsSignatory: true,
          },
          previewPreparedTransaction: () =>
            Effect.fail(new Error('preview failed')),
        }),
      );

      assert.strictEqual(result._tag, 'Failure');
      const artifactRootExists = yield* Effect.tryPromise(() =>
        access(artifactRoot)
          .then(() => true)
          .catch(() => false),
      );
      assert.isFalse(artifactRootExists);
    }),
  );

  it.effect('prepares a root transaction with a direct child subintent', () =>
    Effect.gen(function* () {
      const cwd = yield* makeTempDir('prepare-subintent');
      const artifactRoot = join(cwd, '.rdx', 'transactions');
      const manifestPath = join(cwd, 'root.rtm');
      const subintentsPath = join(cwd, 'subintents.json');
      yield* Effect.tryPromise(() =>
        writeFile(
          manifestPath,
          `${stokenetFaucetManifest}\nYIELD_TO_CHILD NamedIntent("child_one");`,
          'utf8',
        ),
      );
      yield* Effect.tryPromise(() =>
        writeFile(
          subintentsPath,
          JSON.stringify({
            type: 'subintents',
            version: 1,
            subintents: {
              child_one: {
                manifest: 'YIELD_TO_PARENT;',
              },
            },
          }),
          'utf8',
        ),
      );

      const result = yield* prepareTransactionArtifacts({
        artifactRoot,
        network: stokenet,
        manifestPath,
        subintentsPath,
        notary: {
          publicKey: notaryPublicKey,
          notaryIsSignatory: true,
        },
      });

      const prepared = Schema.decodeUnknownSync(PreparedTransactionSchema)(
        JSON.parse(
          yield* Effect.tryPromise(() => readFile(result.preparedPath, 'utf8')),
        ),
      );
      assert.deepEqual(prepared.subintentOrder, ['child_one']);

      const rootManifest = yield* Effect.tryPromise(() =>
        readFile(join(result.artifactPath, 'rootManifest.rtm'), 'utf8'),
      );
      assert.include(rootManifest, 'USE_CHILD');
      assert.include(rootManifest, 'NamedIntent("child_one")');

      const childManifest = yield* Effect.tryPromise(() =>
        readFile(join(result.artifactPath, 'subintents/child_one.rtm'), 'utf8'),
      );
      assert.strictEqual(childManifest, 'YIELD_TO_PARENT;');

      const transactionIntent = JSON.parse(
        yield* Effect.tryPromise(() =>
          readFile(result.transactionIntentPath, 'utf8'),
        ),
      );
      assert.lengthOf(
        transactionIntent.encoded.value.rootIntentCore.children,
        1,
      );
      assert.lengthOf(transactionIntent.encoded.value.nonRootSubintents, 1);
    }),
  );
});
