import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { it } from '@effect/vitest';
import { Convert, RadixEngineToolkit } from '@steleaio/radix-engine-toolkit';
import { Effect, Schema } from 'effect';
import { describe, expect } from 'vitest';

import {
  PreparedSubintentSchema,
  SignatureTemplateSchema,
  SigningRequestSchema,
} from './schemas';
import {
  buildSignedPartialTransaction,
  prepareSubintentArtifacts,
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
      yield* Effect.promise(() => writeFile(manifestPath, manifest, 'utf8'));
      yield* Effect.promise(() =>
        writeFile(headerPath, JSON.stringify(header), 'utf8'),
      );
      yield* Effect.promise(() =>
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

      const prepared = Schema.decodeUnknownSync(PreparedSubintentSchema)(
        JSON.parse(
          yield* Effect.promise(() => readFile(result.preparedPath, 'utf8')),
        ),
      );
      expect(prepared.subintentHash.id).toMatch(/^subtxid_rdx1/);
      expect(prepared.networkId).toBe(1);
      expect(result.signatureTemplatePath).toBe(
        join(result.artifactPath, 'signature-template.json'),
      );

      const request = Schema.decodeUnknownSync(SigningRequestSchema)(
        JSON.parse(
          yield* Effect.promise(() =>
            readFile(join(result.artifactPath, 'signing-request.json'), 'utf8'),
          ),
        ),
      );
      expect(request.scope).toEqual({ kind: 'subintent', subintentId: 'root' });
      expect(request.hash).toEqual(prepared.subintentHash);

      const template = Schema.decodeUnknownSync(SignatureTemplateSchema)(
        JSON.parse(
          yield* Effect.promise(() =>
            readFile(result.signatureTemplatePath, 'utf8'),
          ),
        ),
      );
      expect(template.hash).toEqual(prepared.subintentHash);

      const previewRoot = yield* Effect.promise(() =>
        readFile(join(result.artifactPath, 'preview-root.rtm'), 'utf8'),
      );
      expect(previewRoot).toContain(prepared.subintentHash.id);
      expect(previewRoot).not.toContain('<subintentHash>');
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
        yield* Effect.promise(() => writeFile(manifestPath, manifest, 'utf8'));
        yield* Effect.promise(() =>
          writeFile(headerPath, JSON.stringify(header), 'utf8'),
        );

        const prepared = yield* prepareSubintentArtifacts({
          artifactRoot,
          manifestPath,
          headerPath,
          noPreview: true,
        });
        const signaturePath = join(cwd, 'signature.json');
        yield* Effect.promise(() =>
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

        const hex = yield* Effect.promise(() =>
          readFile(result.signedPartialTransactionPath, 'utf8'),
        );
        expect(hex).toBe(result.signedPartialTransactionHex);

        const signedPartialTransaction = yield* Effect.promise(() =>
          RadixEngineToolkit.SignedPartialTransactionV2.decompile(
            Convert.HexString.toUint8Array(result.signedPartialTransactionHex),
            1,
          ),
        );
        expect(
          signedPartialTransaction.partialTransaction.rootSubintent.intentCore
            .header,
        ).toEqual(header.header);
        expect(signedPartialTransaction.rootSubintentSignatures).toHaveLength(
          1,
        );
      }),
  );
});
