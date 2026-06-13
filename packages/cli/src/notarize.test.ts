import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, assert, describe, it, vi } from '@effect/vitest';
import { RadixEngineToolkit } from '@steleaio/radix-engine-toolkit';
import { Effect, Schema } from 'effect';

import {
  gatewayNotarizePreview,
  notarizeTransactionArtifact,
} from './notarize';
import {
  NetworkSchema,
  SignatureTemplateSchema,
  type SigningRequest,
  SigningRequestSchema,
} from './schemas';
import { makeTempDir } from './test-helpers';

const transactionId = 'txid';
const hashHex = 'aabbcc';
const notaryPublicKeyHex = '1'.repeat(64);
const stokenet = NetworkSchema.make('stokenet');
const stokenetFaucetManifest =
  'CALL_METHOD Address("component_tdx_2_1cptxxxxxxxxxfaucetxxxxxxxxx000527798379xxxxxxxxxyulkzl") "lock_fee" Decimal("10"); CALL_METHOD Address("component_tdx_2_1cptxxxxxxxxxfaucetxxxxxxxxx000527798379xxxxxxxxxyulkzl") "free"; CALL_METHOD Address("account_tdx_2_1284vgk4yrqj7p0plsa2hptcxrt9lpw2s446jlu8egcl7zwk4wzg36g") "try_deposit_batch_or_abort" Expression("ENTIRE_WORKTOP") Enum<0u8>();';

const signingRequest: SigningRequest = {
  type: 'signingRequest',
  version: 1,
  transactionId,
  scope: { kind: 'rootIntent' },
  account: 'account_rdx1...',
  hash: { id: 'intent', hex: hashHex },
  signingRequestPath: 'signing-requests/root/account_rdx1.json',
};

describe('tx notarize workflow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.effect('fails notarize preview when the gateway receipt fails', () =>
    Effect.gen(function* () {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            receipt: {
              status: 'Failed',
              error_message: 'signature rejected',
            },
          }),
          { status: 200 },
        ),
      );

      const result = yield* Effect.result(
        gatewayNotarizePreview({
          config: { network: stokenet },
          previewTransactionHex: 'aa',
        }),
      );

      assert.strictEqual(result._tag, 'Failure');
      if (result._tag === 'Failure') {
        assert.strictEqual(result.failure._tag, 'NotarizeError');
        assert.strictEqual(result.failure.code, 'PREVIEW_FAILED');
      }
    }),
  );

  it.effect(
    'creates a notary signing request after required signatures are complete',
    () =>
      Effect.gen(function* () {
        const artifactRoot = yield* makeTempDir('notarize');
        const artifactPath = join(artifactRoot, transactionId);
        yield* writeArtifactFixture(artifactPath, { complete: true });

        const result = yield* notarizeTransactionArtifact({
          artifactRoot,
          transactionId,
        });

        assert.deepInclude(result, {
          transactionId,
          signedTransactionIntentPath: join(
            artifactPath,
            'signedTransactionIntent.json',
          ),
          notarySigningRequestPath: join(
            artifactPath,
            'signing-requests/notary.json',
          ),
          notarySignatureTemplatePath: join(
            artifactPath,
            'signature-templates/notary.json',
          ),
        });

        const requestJson = yield* Effect.tryPromise(() =>
          readFile(result.notarySigningRequestPath, 'utf8'),
        );
        const request = Schema.decodeUnknownSync(SigningRequestSchema)(
          JSON.parse(requestJson),
        );
        assert.deepInclude(request, {
          transactionId,
          scope: { kind: 'notary' },
          account: null,
        });
        assert.match(request.hash.hex, /^[0-9a-f]{64}$/);

        const templateJson = yield* Effect.tryPromise(() =>
          readFile(result.notarySignatureTemplatePath, 'utf8'),
        );
        const template = Schema.decodeUnknownSync(SignatureTemplateSchema)(
          JSON.parse(templateJson),
        );
        assert.deepInclude(template, {
          transactionId,
          scope: { kind: 'notary' },
          publicKey: { curve: 'Ed25519', hex: notaryPublicKeyHex },
        });

        const prepared = JSON.parse(
          yield* Effect.tryPromise(() =>
            readFile(join(artifactPath, 'prepared.json'), 'utf8'),
          ),
        );
        assert.include(
          prepared.signingRequests,
          'signing-requests/notary.json',
        );
        assert.include(
          prepared.signatureTemplates,
          'signature-templates/notary.json',
        );
      }),
  );

  it.effect(
    'rejects notarization when prepared signatures are incomplete',
    () =>
      Effect.gen(function* () {
        const artifactRoot = yield* makeTempDir('notarize-incomplete');
        const artifactPath = join(artifactRoot, transactionId);
        yield* writeArtifactFixture(artifactPath, { complete: false });

        const result = yield* Effect.result(
          notarizeTransactionArtifact({ artifactRoot, transactionId }),
        );

        assert.strictEqual(result._tag, 'Failure');
        if (result._tag === 'Failure') {
          assert.deepInclude(result.failure, {
            _tag: 'NotarizeError',
            code: 'INCOMPLETE_SIGNATURES',
          });
        }
      }),
  );

  it.effect('reports a missing signature file before notarization', () =>
    Effect.gen(function* () {
      const artifactRoot = yield* makeTempDir('notarize-missing-signatures');
      const artifactPath = join(artifactRoot, transactionId);
      yield* writeArtifactFixture(artifactPath, {
        complete: false,
        omitSignaturesFile: true,
      });

      const result = yield* Effect.result(
        notarizeTransactionArtifact({ artifactRoot, transactionId }),
      );

      assert.strictEqual(result._tag, 'Failure');
      if (result._tag === 'Failure') {
        assert.deepInclude(result.failure, {
          _tag: 'NotarizeError',
          code: 'MISSING_SIGNATURE_FILE',
        });
      }
    }),
  );

  it.effect(
    'creates a notary signing request when no intent signatures are required',
    () =>
      Effect.gen(function* () {
        const artifactRoot = yield* makeTempDir('notarize-no-auth');
        const artifactPath = join(artifactRoot, transactionId);
        yield* writeArtifactFixture(artifactPath, {
          complete: true,
          noRequiredSignatures: true,
        });

        const result = yield* notarizeTransactionArtifact({
          artifactRoot,
          transactionId,
        });

        assert.strictEqual(
          result.notarySigningRequestPath,
          join(artifactPath, 'signing-requests/notary.json'),
        );
      }),
  );

  it.effect('blocks notary request creation when notarize preview fails', () =>
    Effect.gen(function* () {
      const artifactRoot = yield* makeTempDir('notarize-preview-fails');
      const artifactPath = join(artifactRoot, transactionId);
      yield* writeArtifactFixture(artifactPath, { complete: true });

      const result = yield* Effect.result(
        notarizeTransactionArtifact({
          artifactRoot,
          transactionId,
          previewSignedTransactionIntent: () =>
            Effect.fail(new Error('preview failed')),
        }),
      );

      assert.strictEqual(result._tag, 'Failure');
      const notaryRequestExists = yield* Effect.tryPromise(() =>
        access(join(artifactPath, 'signing-requests/notary.json'))
          .then(() => true)
          .catch(() => false),
      );
      assert.isFalse(notaryRequestExists);
    }),
  );

  it.effect(
    'derives the notary request for prepared transactions with direct child subintents',
    () =>
      Effect.gen(function* () {
        const artifactRoot = yield* makeTempDir('notarize-subintent');
        const artifactPath = join(artifactRoot, transactionId);
        yield* writeArtifactFixture(artifactPath, {
          complete: true,
          withSubintent: true,
        });

        const result = yield* notarizeTransactionArtifact({
          artifactRoot,
          transactionId,
          previewSignedTransactionIntent: () => Effect.void,
        });

        const requestJson = yield* Effect.tryPromise(() =>
          readFile(result.notarySigningRequestPath, 'utf8'),
        );
        const request = Schema.decodeUnknownSync(SigningRequestSchema)(
          JSON.parse(requestJson),
        );
        assert.deepEqual(request.scope, { kind: 'notary' });
      }),
  );
});

const writeArtifactFixture = (
  artifactPath: string,
  input: {
    complete: boolean;
    withSubintent?: boolean;
    noRequiredSignatures?: boolean;
    omitSignaturesFile?: boolean;
  },
) =>
  Effect.tryPromise(async () => {
    const childSubintent = input.withSubintent
      ? {
          intentCore: {
            header: {
              networkId: 2,
              startEpochInclusive: 1,
              endEpochExclusive: 10,
              intentDiscriminator: 1,
            },
            instructions: 'YIELD_TO_PARENT;',
            blobs: [],
            message: { kind: 'None' as const },
            children: [],
          },
        }
      : undefined;
    const childHash = childSubintent
      ? await RadixEngineToolkit.SubintentV2.hash(childSubintent)
      : undefined;
    await mkdir(join(artifactPath, 'signing-requests', 'root'), {
      recursive: true,
    });
    await writeFile(
      join(artifactPath, 'prepared.json'),
      JSON.stringify(
        {
          type: 'preparedTransaction',
          version: 1,
          transactionId,
          network: 'mainnet',
          intentHash: { id: 'intent', hex: hashHex },
          manifestSourceFile: 'root.rtm',
          transactionIntentPath: 'transactionIntent.json',
          staticAnalysisPath: 'staticAnalysis.json',
          signingRequests: input.noRequiredSignatures
            ? []
            : input.withSubintent
              ? [
                  signingRequest.signingRequestPath,
                  'signing-requests/subintents/child_one/account_rdx1-child.json',
                ]
              : [signingRequest.signingRequestPath],
          signatureTemplates: [],
          subintentOrder: input.withSubintent ? ['child_one'] : [],
          authorizationAnalysis: {
            rootIntent: input.noRequiredSignatures ? [] : ['account_rdx1'],
            subintents: input.withSubintent
              ? { child_one: ['account_rdx1-child'] }
              : {},
          },
          notaryPublicKey: { curve: 'Ed25519', hex: notaryPublicKeyHex },
          notaryIsSignatory: true,
        },
        null,
        2,
      ),
      'utf8',
    );
    if (!input.noRequiredSignatures) {
      await writeFile(
        join(artifactPath, signingRequest.signingRequestPath ?? ''),
        JSON.stringify(signingRequest, null, 2),
        'utf8',
      );
    }
    if (input.withSubintent) {
      await mkdir(join(artifactPath, 'signing-requests/subintents/child_one'), {
        recursive: true,
      });
      await writeFile(
        join(
          artifactPath,
          'signing-requests/subintents/child_one/account_rdx1-child.json',
        ),
        JSON.stringify(
          {
            type: 'signingRequest',
            version: 1,
            transactionId,
            scope: { kind: 'subintent', subintentId: 'child_one' },
            account: 'account_rdx1-child',
            hash: { id: 'subtxid_child', hex: hashHex },
            signingRequestPath:
              'signing-requests/subintents/child_one/account_rdx1-child.json',
          },
          null,
          2,
        ),
        'utf8',
      );
    }
    await writeFile(
      join(artifactPath, 'transactionIntent.json'),
      JSON.stringify(
        {
          type: 'transactionIntent',
          version: 1,
          transactionId,
          encoded: {
            kind: 'transactionIntentV2',
            value: {
              transactionHeader: {
                notaryPublicKey: notaryPublicKeyHex,
                notaryIsSignatory: true,
                tipBasisPoints: 0,
              },
              rootIntentCore: {
                header: {
                  networkId: 2,
                  startEpochInclusive: 1,
                  endEpochExclusive: 10,
                  intentDiscriminator: 0,
                },
                instructions: stokenetFaucetManifest,
                blobs: [],
                message: { kind: 'None' },
                children: childHash
                  ? [Buffer.from(childHash.hash).toString('hex')]
                  : [],
              },
              nonRootSubintents: input.withSubintent ? [childSubintent] : [],
            },
          },
        },
        null,
        2,
      ),
      'utf8',
    );
    if (!input.noRequiredSignatures && !input.omitSignaturesFile) {
      await writeFile(
        join(artifactPath, 'signatures.json'),
        JSON.stringify(
          {
            type: 'signatureFile',
            version: 1,
            transactionId,
            signatures: input.complete
              ? [
                  {
                    scope: signingRequest.scope,
                    account: signingRequest.account,
                    hash: signingRequest.hash,
                    signingRequestPath: signingRequest.signingRequestPath,
                    publicKey: { curve: 'Ed25519', hex: '2'.repeat(64) },
                    signature: { curve: 'Ed25519', hex: '3'.repeat(128) },
                  },
                  ...(input.withSubintent
                    ? [
                        {
                          scope: {
                            kind: 'subintent',
                            subintentId: 'child_one',
                          },
                          account: 'account_rdx1-child',
                          hash: { id: 'subtxid_child', hex: hashHex },
                          signingRequestPath:
                            'signing-requests/subintents/child_one/account_rdx1-child.json',
                          publicKey: { curve: 'Ed25519', hex: '2'.repeat(64) },
                          signature: {
                            curve: 'Ed25519',
                            hex: '3'.repeat(128),
                          },
                        },
                      ]
                    : []),
                ]
              : [],
          },
          null,
          2,
        ),
        'utf8',
      );
    }
  });
