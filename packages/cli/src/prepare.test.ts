import { access, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { it } from '@effect/vitest';
import { Effect, Schema } from 'effect';
import { describe, expect } from 'vitest';
import { prepareTransactionArtifacts } from './prepare';
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
  it.effect('writes durable prepared transaction artifacts', () =>
    Effect.gen(function* () {
      const cwd = yield* makeTempDir('prepare-cwd');
      const artifactRoot = join(cwd, '.rdx', 'transactions');
      const manifestPath = join(cwd, 'root.rtm');
      yield* Effect.promise(() =>
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

      expect(result.transactionId).toMatch(/^txid_tdx_2_/);
      expect(result.preparedPath).toBe(
        join(result.artifactPath, 'prepared.json'),
      );
      expect(result.signatureTemplatePaths).toContain(
        join(result.artifactPath, 'signature-templates/notary-signatory.json'),
      );

      const prepared = Schema.decodeUnknownSync(PreparedTransactionSchema)(
        JSON.parse(
          yield* Effect.promise(() => readFile(result.preparedPath, 'utf8')),
        ),
      );
      expect(prepared).toMatchObject({
        type: 'preparedTransaction',
        transactionId: result.transactionId,
        network: stokenet,
        transactionIntentPath: 'transactionIntent.json',
        staticAnalysisPath: 'staticAnalysis.json',
        notaryPublicKey,
        authorizationAnalysis: {
          rootIntent: [],
          subintents: {},
        },
      });

      const request = Schema.decodeUnknownSync(SigningRequestSchema)(
        JSON.parse(
          yield* Effect.promise(() =>
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
      expect(request.scope).toEqual({ kind: 'notarySignatory' });

      const template = Schema.decodeUnknownSync(SignatureTemplateSchema)(
        JSON.parse(
          yield* Effect.promise(() =>
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
      expect(template.publicKey).toEqual(notaryPublicKey);
    }),
  );

  it.effect('fails rather than overwriting existing artifacts', () =>
    Effect.gen(function* () {
      const cwd = yield* makeTempDir('prepare-overwrite');
      const artifactRoot = join(cwd, '.rdx', 'transactions');
      const manifestPath = join(cwd, 'root.rtm');
      yield* Effect.promise(() =>
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

      expect(result._tag).toBe('Failure');
    }),
  );

  it.effect('blocks artifact creation when prepare preview fails', () =>
    Effect.gen(function* () {
      const cwd = yield* makeTempDir('prepare-preview-fails');
      const artifactRoot = join(cwd, '.rdx', 'transactions');
      const manifestPath = join(cwd, 'root.rtm');
      yield* Effect.promise(() =>
        writeFile(manifestPath, stokenetFaucetManifest, 'utf8'),
      );

      const result = yield* Effect.either(
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

      expect(result._tag).toBe('Left');
      const artifactRootExists = yield* Effect.promise(() =>
        access(artifactRoot)
          .then(() => true)
          .catch(() => false),
      );
      expect(artifactRootExists).toBe(false);
    }),
  );

  it.effect('prepares a root transaction with a direct child subintent', () =>
    Effect.gen(function* () {
      const cwd = yield* makeTempDir('prepare-subintent');
      const artifactRoot = join(cwd, '.rdx', 'transactions');
      const manifestPath = join(cwd, 'root.rtm');
      const subintentsPath = join(cwd, 'subintents.json');
      yield* Effect.promise(() =>
        writeFile(
          manifestPath,
          `${stokenetFaucetManifest}\nYIELD_TO_CHILD NamedIntent("child_one");`,
          'utf8',
        ),
      );
      yield* Effect.promise(() =>
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
          yield* Effect.promise(() => readFile(result.preparedPath, 'utf8')),
        ),
      );
      expect(prepared.subintentOrder).toEqual(['child_one']);

      const rootManifest = yield* Effect.promise(() =>
        readFile(join(result.artifactPath, 'rootManifest.rtm'), 'utf8'),
      );
      expect(rootManifest).toContain('USE_CHILD');
      expect(rootManifest).toContain('NamedIntent("child_one")');

      const childManifest = yield* Effect.promise(() =>
        readFile(join(result.artifactPath, 'subintents/child_one.rtm'), 'utf8'),
      );
      expect(childManifest).toBe('YIELD_TO_PARENT;');

      const transactionIntent = JSON.parse(
        yield* Effect.promise(() =>
          readFile(result.transactionIntentPath, 'utf8'),
        ),
      );
      expect(
        transactionIntent.encoded.value.rootIntentCore.children,
      ).toHaveLength(1);
      expect(transactionIntent.encoded.value.nonRootSubintents).toHaveLength(1);
    }),
  );
});
