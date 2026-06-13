import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { assert, describe, it } from '@effect/vitest';
import { Convert, RadixEngineToolkit } from '@steleaio/radix-engine-toolkit';
import { Effect, Schema } from 'effect';

import {
  PreparedSubintentSchema,
  SignatureTemplateSchema,
  SigningRequestSchema,
} from './schemas';
import {
  buildSignedPartialTransaction,
  prepareSubintentArtifacts,
  SubintentPreviewRootManifestError,
} from './subintent';
import { makeTempDir } from './test-helpers';

const manifest = 'YIELD_TO_PARENT;';
const header = {
  type: 'subintentHeader',
  version: 1,
  header: {
    networkId: 1,
    startEpochInclusive: 1,
    endEpochExclusive: 10,
    intentDiscriminator: 123,
  },
};
const publicKeyHex =
  '1111111111111111111111111111111111111111111111111111111111111111';
const signatureHex =
  '22222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222';

describe('subintent workflow', () => {
  it.effect('prepares a standalone root subintent for signing', () =>
    Effect.gen(function* () {
      const cwd = yield* makeTempDir('subintent-prepare');
      const artifactRoot = join(cwd, '.rdx', 'subintents');
      const manifestPath = join(cwd, 'payment.rtm');
      const headerPath = join(cwd, 'subintent-header.json');
      const rootManifestPath = join(cwd, 'preview-root.rtm');
      yield* Effect.tryPromise(() => writeFile(manifestPath, manifest, 'utf8'));
      yield* Effect.tryPromise(() =>
        writeFile(headerPath, JSON.stringify(header), 'utf8'),
      );
      yield* Effect.tryPromise(() =>
        writeFile(
          rootManifestPath,
          'USE_CHILD NamedIntent("payment") Intent("<subintentHash>");\nYIELD_TO_CHILD NamedIntent("payment");',
          'utf8',
        ),
      );

      const result = yield* prepareSubintentArtifacts({
        artifactRoot,
        manifestPath,
        headerPath,
        rootManifestPath,
      });

      const prepared = yield* Schema.decodeUnknownEffect(
        PreparedSubintentSchema,
      )(
        JSON.parse(
          yield* Effect.tryPromise(() => readFile(result.preparedPath, 'utf8')),
        ),
      );
      const subintentHashId = prepared.subintentHash.id;
      if (subintentHashId === null) {
        assert.fail('Expected prepared subintent hash to include an id');
      }
      assert.match(subintentHashId, /^subtxid_rdx1/);
      assert.strictEqual(prepared.networkId, 1);
      assert.strictEqual(
        result.signatureTemplatePath,
        join(result.artifactPath, 'signature-template.json'),
      );

      const request = yield* Schema.decodeUnknownEffect(SigningRequestSchema)(
        JSON.parse(
          yield* Effect.tryPromise(() =>
            readFile(join(result.artifactPath, 'signing-request.json'), 'utf8'),
          ),
        ),
      );
      assert.deepEqual(request.scope, {
        kind: 'subintent',
        subintentId: 'root',
      });
      assert.deepEqual(request.hash, prepared.subintentHash);

      const template = yield* Schema.decodeUnknownEffect(
        SignatureTemplateSchema,
      )(
        JSON.parse(
          yield* Effect.tryPromise(() =>
            readFile(result.signatureTemplatePath, 'utf8'),
          ),
        ),
      );
      assert.deepEqual(template.hash, prepared.subintentHash);

      const previewRoot = yield* Effect.tryPromise(() =>
        readFile(join(result.artifactPath, 'preview-root.rtm'), 'utf8'),
      );
      assert.include(previewRoot, subintentHashId);
      assert.notInclude(previewRoot, '<subintentHash>');
    }),
  );

  it.effect(
    'rejects preview root manifests without exactly one subintent hash placeholder',
    () =>
      Effect.gen(function* () {
        const cwd = yield* makeTempDir('subintent-preview-placeholder');
        const artifactRoot = join(cwd, '.rdx', 'subintents');
        const manifestPath = join(cwd, 'payment.rtm');
        const headerPath = join(cwd, 'subintent-header.json');
        const rootManifestPath = join(cwd, 'preview-root.rtm');
        yield* Effect.tryPromise(() =>
          writeFile(manifestPath, manifest, 'utf8'),
        );
        yield* Effect.tryPromise(() =>
          writeFile(headerPath, JSON.stringify(header), 'utf8'),
        );
        yield* Effect.tryPromise(() =>
          writeFile(
            rootManifestPath,
            'YIELD_TO_CHILD NamedIntent("payment");',
            'utf8',
          ),
        );

        const result = yield* Effect.result(
          prepareSubintentArtifacts({
            artifactRoot,
            manifestPath,
            headerPath,
            rootManifestPath,
          }),
        );

        assert.strictEqual(result._tag, 'Failure');
        if (result._tag === 'Failure') {
          assert.instanceOf(result.failure, SubintentPreviewRootManifestError);
          assert.strictEqual(result.failure.placeholderCount, 0);
        }
      }),
  );

  it.effect(
    'builds signed partial transaction hex from a prepared subintent',
    () =>
      Effect.gen(function* () {
        const cwd = yield* makeTempDir('subintent-build');
        const artifactRoot = join(cwd, '.rdx', 'subintents');
        const manifestPath = join(cwd, 'payment.rtm');
        const headerPath = join(cwd, 'subintent-header.json');
        yield* Effect.tryPromise(() =>
          writeFile(manifestPath, manifest, 'utf8'),
        );
        yield* Effect.tryPromise(() =>
          writeFile(headerPath, JSON.stringify(header), 'utf8'),
        );

        const prepared = yield* prepareSubintentArtifacts({
          artifactRoot,
          manifestPath,
          headerPath,
          noPreview: true,
        });
        const signaturePath = join(cwd, 'signature.json');
        yield* Effect.tryPromise(() =>
          writeFile(
            signaturePath,
            JSON.stringify({
              type: 'signatureFile',
              version: 1,
              transactionId: prepared.subintentHash.id,
              signatures: [
                {
                  scope: { kind: 'subintent', subintentId: 'root' },
                  account: null,
                  hash: prepared.subintentHash,
                  publicKey: { curve: 'Ed25519', hex: publicKeyHex },
                  signature: { curve: 'Ed25519', hex: signatureHex },
                },
              ],
            }),
            'utf8',
          ),
        );

        const result = yield* buildSignedPartialTransaction({
          preparedPath: prepared.preparedPath,
          signaturePath,
        });

        const hex = yield* Effect.tryPromise(() =>
          readFile(result.signedPartialTransactionPath, 'utf8'),
        );
        assert.strictEqual(hex, result.signedPartialTransactionHex);

        const signedPartialTransaction = yield* Effect.tryPromise(() =>
          RadixEngineToolkit.SignedPartialTransactionV2.decompile(
            Convert.HexString.toUint8Array(result.signedPartialTransactionHex),
            1,
          ),
        );
        const decodedHeader =
          signedPartialTransaction.partialTransaction.rootSubintent.intentCore
            .header;
        assert.strictEqual(decodedHeader.networkId, header.header.networkId);
        assert.strictEqual(
          decodedHeader.startEpochInclusive,
          header.header.startEpochInclusive,
        );
        assert.strictEqual(
          decodedHeader.endEpochExclusive,
          header.header.endEpochExclusive,
        );
        assert.strictEqual(
          decodedHeader.intentDiscriminator,
          header.header.intentDiscriminator,
        );
        assert.lengthOf(signedPartialTransaction.rootSubintentSignatures, 1);
      }),
  );
});
