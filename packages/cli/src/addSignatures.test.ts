import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { assert, describe, it } from '@effect/vitest';
import { ed25519 } from '@noble/curves/ed25519';
import { Effect, Schema } from 'effect';

import { addSignaturesToArtifact } from './addSignatures';
import { SignatureFileSchema, type SigningRequest } from './schemas';
import { SignatureImportError } from './signatureImport';
import { makeTempDir } from './test-helpers';

const privateKey = new Uint8Array(32).fill(1);
const hashHex = 'aabbcc';
const publicKeyHex = Buffer.from(ed25519.getPublicKey(privateKey)).toString(
  'hex',
);
const signatureHex = Buffer.from(
  ed25519.sign(Buffer.from(hashHex, 'hex'), privateKey),
).toString('hex');

const signingRequest: SigningRequest = {
  type: 'signingRequest',
  version: 1,
  transactionId: 'txid',
  scope: { kind: 'rootIntent' },
  account: 'account_rdx1...',
  hash: { id: 'intent', hex: hashHex },
  signingRequestPath: 'signing-requests/root/account_rdx1.json',
};

describe('tx add-signatures workflow', () => {
  it.effect('imports signature files into canonical signatures.json', () =>
    Effect.gen(function* () {
      const artifactRoot = yield* makeTempDir('add-signatures');
      const artifactPath = join(artifactRoot, 'txid');
      const signaturePath = join(artifactRoot, 'signature.json');
      yield* writeArtifactFixture(artifactPath);
      yield* Effect.tryPromise(() =>
        writeFile(
          signaturePath,
          JSON.stringify({
            type: 'signatureFile',
            version: 1,
            transactionId: 'txid',
            signatures: [
              {
                scope: signingRequest.scope,
                account: signingRequest.account,
                hash: signingRequest.hash,
                signingRequestPath: signingRequest.signingRequestPath,
                publicKey: { curve: 'Ed25519', hex: publicKeyHex },
                signature: { curve: 'Ed25519', hex: signatureHex },
              },
            ],
          }),
          'utf8',
        ),
      );

      const result = yield* addSignaturesToArtifact({
        artifactRoot,
        transactionId: 'txid',
        signatureFilePaths: [signaturePath],
      });

      assert.strictEqual(result.acceptedCount, 1);
      assert.isTrue(result.complete);

      const signaturesJson = yield* Effect.tryPromise(() =>
        readFile(join(artifactPath, 'signatures.json'), 'utf8'),
      );
      const signatures = Schema.decodeUnknownSync(SignatureFileSchema)(
        JSON.parse(signaturesJson),
      );
      assert.lengthOf(signatures.signatures, 1);
    }),
  );

  it.effect('rejects signature files for a different transaction', () =>
    Effect.gen(function* () {
      const artifactRoot = yield* makeTempDir('add-signatures');
      const artifactPath = join(artifactRoot, 'txid');
      const signaturePath = join(artifactRoot, 'signature.json');
      yield* writeArtifactFixture(artifactPath);
      yield* Effect.tryPromise(() =>
        writeFile(
          signaturePath,
          JSON.stringify({
            type: 'signatureFile',
            version: 1,
            transactionId: 'other-txid',
            signatures: [
              {
                scope: signingRequest.scope,
                account: signingRequest.account,
                hash: signingRequest.hash,
                signingRequestPath: signingRequest.signingRequestPath,
                publicKey: { curve: 'Ed25519', hex: publicKeyHex },
                signature: { curve: 'Ed25519', hex: signatureHex },
              },
            ],
          }),
          'utf8',
        ),
      );

      const result = yield* Effect.result(
        addSignaturesToArtifact({
          artifactRoot,
          transactionId: 'txid',
          signatureFilePaths: [signaturePath],
        }),
      );

      assert.strictEqual(result._tag, 'Failure');
      if (result._tag === 'Failure') {
        assert.instanceOf(result.failure, SignatureImportError);
        assert.strictEqual(result.failure.code, 'UNKNOWN_SIGNING_REQUEST');
      }
    }),
  );
});

const writeArtifactFixture = (artifactPath: string) =>
  Effect.tryPromise(async () => {
    await mkdir(join(artifactPath, 'signing-requests', 'root'), {
      recursive: true,
    });
    await writeFile(
      join(artifactPath, 'prepared.json'),
      JSON.stringify(
        {
          type: 'preparedTransaction',
          version: 1,
          transactionId: 'txid',
          network: 'mainnet',
          intentHash: { id: 'intent', hex: hashHex },
          manifestSourceFile: 'root.rtm',
          transactionIntentPath: 'transactionIntent.json',
          staticAnalysisPath: 'staticAnalysis.json',
          signingRequests: [signingRequest.signingRequestPath],
          signatureTemplates: [],
          subintentOrder: [],
          authorizationAnalysis: { rootIntent: [], subintents: {} },
        },
        null,
        2,
      ),
      'utf8',
    );
    await writeFile(
      join(artifactPath, signingRequest.signingRequestPath ?? ''),
      JSON.stringify(signingRequest, null, 2),
      'utf8',
    );
  });
