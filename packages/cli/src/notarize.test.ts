import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { it } from '@effect/vitest';
import { RadixEngineToolkit } from '@steleaio/radix-engine-toolkit';
import { Effect, Schema } from 'effect';
import { describe, expect } from 'vitest';

import { notarizeTransactionArtifact } from './notarize';
import {
  SignatureTemplateSchema,
  type SigningRequest,
  SigningRequestSchema,
} from './schemas';
import { makeTempDir } from './test-helpers';

const transactionId = 'txid';
const hashHex = 'aabbcc';
const notaryPublicKeyHex = '1'.repeat(64);
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

        expect(result).toMatchObject({
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

        const requestJson = yield* Effect.promise(() =>
          readFile(result.notarySigningRequestPath, 'utf8'),
        );
        const request = Schema.decodeUnknownSync(SigningRequestSchema)(
          JSON.parse(requestJson),
        );
        expect(request).toMatchObject({
          transactionId,
          scope: { kind: 'notary' },
          account: null,
        });
        expect(request.hash.hex).toMatch(/^[0-9a-f]{64}$/);

        const templateJson = yield* Effect.promise(() =>
          readFile(result.notarySignatureTemplatePath, 'utf8'),
        );
        const template = Schema.decodeUnknownSync(SignatureTemplateSchema)(
          JSON.parse(templateJson),
        );
        expect(template).toMatchObject({
          transactionId,
          scope: { kind: 'notary' },
          publicKey: { curve: 'Ed25519', hex: notaryPublicKeyHex },
        });

        const prepared = JSON.parse(
          yield* Effect.promise(() =>
            readFile(join(artifactPath, 'prepared.json'), 'utf8'),
          ),
        );
        expect(prepared.signingRequests).toContain(
          'signing-requests/notary.json',
        );
        expect(prepared.signatureTemplates).toContain(
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

        const result = yield* Effect.either(
          notarizeTransactionArtifact({ artifactRoot, transactionId }),
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left).toMatchObject({
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

      const result = yield* Effect.either(
        notarizeTransactionArtifact({ artifactRoot, transactionId }),
      );

      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expect(result.left).toMatchObject({
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

        expect(result.notarySigningRequestPath).toBe(
          join(artifactPath, 'signing-requests/notary.json'),
        );
      }),
  );

  it.effect('blocks notary request creation when notarize preview fails', () =>
    Effect.gen(function* () {
      const artifactRoot = yield* makeTempDir('notarize-preview-fails');
      const artifactPath = join(artifactRoot, transactionId);
      yield* writeArtifactFixture(artifactPath, { complete: true });

      const result = yield* Effect.either(
        notarizeTransactionArtifact({
          artifactRoot,
          transactionId,
          previewSignedTransactionIntent: () =>
            Effect.fail(new Error('preview failed')),
        }),
      );

      expect(result._tag).toBe('Left');
      const notaryRequestExists = yield* Effect.promise(() =>
        access(join(artifactPath, 'signing-requests/notary.json'))
          .then(() => true)
          .catch(() => false),
      );
      expect(notaryRequestExists).toBe(false);
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

        const requestJson = yield* Effect.promise(() =>
          readFile(result.notarySigningRequestPath, 'utf8'),
        );
        const request = Schema.decodeUnknownSync(SigningRequestSchema)(
          JSON.parse(requestJson),
        );
        expect(request.scope).toEqual({ kind: 'notary' });
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
  Effect.promise(async () => {
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
