import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { it } from '@effect/vitest';
import { RadixEngineToolkit } from '@steleaio/radix-engine-toolkit';
import { Effect, Schema } from 'effect';
import { afterEach, describe, expect, vi } from 'vitest';
import { NetworkSchema, SubmitResultSchema } from './schemas';
import {
  gatewaySubmitNotarizedTransaction,
  submitTransactionArtifact,
} from './submit';
import { makeTempDir } from './test-helpers';

const transactionId = 'txid';
const notaryPublicKeyHex = '1'.repeat(64);
const stokenet = NetworkSchema.make('stokenet');
const stokenetFaucetManifest =
  'CALL_METHOD Address("component_tdx_2_1cptxxxxxxxxxfaucetxxxxxxxxx000527798379xxxxxxxxxyulkzl") "lock_fee" Decimal("10"); CALL_METHOD Address("component_tdx_2_1cptxxxxxxxxxfaucetxxxxxxxxx000527798379xxxxxxxxxyulkzl") "free";';

describe('tx submit workflow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.effect('submits to the configured network gateway by default', () =>
    Effect.gen(function* () {
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue({ ok: true } as Response);

      yield* gatewaySubmitNotarizedTransaction({
        config: { network: stokenet },
        transactionId,
        notarizedTransactionHex: 'aa',
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://stokenet.radixdlt.com/transaction/submit',
        expect.any(Object),
      );
    }),
  );

  it.effect('compiles a notarized transaction and persists submit result', () =>
    Effect.gen(function* () {
      const artifactRoot = yield* makeTempDir('submit');
      const artifactPath = join(artifactRoot, transactionId);
      yield* writeArtifactFixture(artifactPath);

      const result = yield* submitTransactionArtifact({
        artifactRoot,
        transactionId,
        submitNotarizedTransaction: () =>
          Effect.succeed({
            transactionId,
            status: 'Pending',
            statusDescription: 'Submitted to Gateway',
            errorMessage: null,
            checkedAt: '2026-05-15T00:00:00.000Z',
          }),
      });

      expect(result).toMatchObject({
        transactionId,
        artifactPath,
        notarizedTransactionPath: join(
          artifactPath,
          'notarizedTransaction.hex',
        ),
        submitResultPath: join(artifactPath, 'submitResult.json'),
      });
      expect(
        yield* Effect.promise(() =>
          readFile(result.notarizedTransactionPath, 'utf8'),
        ),
      ).toMatch(/^[0-9a-f]+\n$/);

      const submitResult = Schema.decodeUnknownSync(SubmitResultSchema)(
        JSON.parse(
          yield* Effect.promise(() =>
            readFile(result.submitResultPath, 'utf8'),
          ),
        ),
      );
      expect(submitResult.networkStatus.status).toBe('Pending');
      expect(submitResult.attempts).toHaveLength(1);
    }),
  );

  it.effect('polls transaction status after successful broadcast', () =>
    Effect.gen(function* () {
      const artifactRoot = yield* makeTempDir('submit-poll');
      const artifactPath = join(artifactRoot, transactionId);
      yield* writeArtifactFixture(artifactPath);

      const result = yield* submitTransactionArtifact({
        artifactRoot,
        transactionId,
        submitNotarizedTransaction: () =>
          Effect.succeed({
            transactionId,
            status: 'Submitted',
            statusDescription: 'Submitted to Gateway',
            errorMessage: null,
            checkedAt: '2026-05-15T00:00:00.000Z',
          }),
        pollTransactionStatus: () =>
          Effect.succeed({
            transactionId,
            status: 'CommittedSuccess',
            statusDescription: 'Committed',
            errorMessage: null,
            checkedAt: '2026-05-15T00:01:00.000Z',
          }),
      });

      const submitResult = Schema.decodeUnknownSync(SubmitResultSchema)(
        JSON.parse(
          yield* Effect.promise(() =>
            readFile(result.submitResultPath, 'utf8'),
          ),
        ),
      );
      expect(submitResult.networkStatus.status).toBe('CommittedSuccess');
      expect(submitResult.attempts.map((attempt) => attempt.status)).toEqual([
        'Submitted',
        'CommittedSuccess',
      ]);
    }),
  );

  it.effect(
    'refuses to resubmit an artifact with a committed success result',
    () =>
      Effect.gen(function* () {
        const artifactRoot = yield* makeTempDir('submit-success-resubmit');
        const artifactPath = join(artifactRoot, transactionId);
        yield* writeArtifactFixture(artifactPath);
        yield* writeSubmitResultFixture(artifactPath, {
          status: 'CommittedSuccess',
          checkedAt: '2026-05-15T00:00:00.000Z',
        });
        let submitCalls = 0;

        const result = yield* Effect.either(
          submitTransactionArtifact({
            artifactRoot,
            transactionId,
            submitNotarizedTransaction: () => {
              submitCalls += 1;
              return Effect.succeed({
                transactionId,
                status: 'Pending',
                statusDescription: 'Submitted to Gateway',
                errorMessage: null,
                checkedAt: '2026-05-15T00:01:00.000Z',
              });
            },
          }),
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left).toMatchObject({
            _tag: 'SubmitError',
            code: 'ALREADY_SUBMITTED',
          });
        }
        expect(submitCalls).toBe(0);
      }),
  );

  it.effect(
    'records retry attempts after a failed previous submit result',
    () =>
      Effect.gen(function* () {
        const artifactRoot = yield* makeTempDir('submit-failed-retry');
        const artifactPath = join(artifactRoot, transactionId);
        yield* writeArtifactFixture(artifactPath);
        yield* writeSubmitResultFixture(artifactPath, {
          status: 'CommittedFailure',
          checkedAt: '2026-05-15T00:00:00.000Z',
        });

        const result = yield* submitTransactionArtifact({
          artifactRoot,
          transactionId,
          submitNotarizedTransaction: () =>
            Effect.succeed({
              transactionId,
              status: 'Pending',
              statusDescription: 'Submitted to Gateway',
              errorMessage: null,
              checkedAt: '2026-05-15T00:01:00.000Z',
            }),
        });

        const submitResult = Schema.decodeUnknownSync(SubmitResultSchema)(
          JSON.parse(
            yield* Effect.promise(() =>
              readFile(result.submitResultPath, 'utf8'),
            ),
          ),
        );
        expect(submitResult.attempts.map((attempt) => attempt.status)).toEqual([
          'CommittedFailure',
          'Pending',
        ]);
      }),
  );

  it.effect(
    'refuses to submit when prepared intent signatures are missing',
    () =>
      Effect.gen(function* () {
        const artifactRoot = yield* makeTempDir('submit-missing-intent');
        const artifactPath = join(artifactRoot, transactionId);
        yield* writeArtifactFixture(artifactPath, {
          missingRootSignature: true,
        });
        let submitCalls = 0;

        const result = yield* Effect.either(
          submitTransactionArtifact({
            artifactRoot,
            transactionId,
            submitNotarizedTransaction: () => {
              submitCalls += 1;
              return Effect.succeed({
                transactionId,
                status: 'Pending',
                statusDescription: 'Submitted to Gateway',
                errorMessage: null,
                checkedAt: '2026-05-15T00:00:00.000Z',
              });
            },
          }),
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left).toMatchObject({
            _tag: 'SubmitError',
            code: 'MISSING_SIGNATURE',
          });
        }
        expect(submitCalls).toBe(0);
      }),
  );

  it.effect(
    'compiles notarized transactions with direct child subintents',
    () =>
      Effect.gen(function* () {
        const artifactRoot = yield* makeTempDir('submit-subintent');
        const artifactPath = join(artifactRoot, transactionId);
        yield* writeArtifactFixture(artifactPath, { withSubintent: true });

        const result = yield* submitTransactionArtifact({
          artifactRoot,
          transactionId,
          submitNotarizedTransaction: () =>
            Effect.succeed({
              transactionId,
              status: 'Pending',
              statusDescription: 'Submitted to Gateway',
              errorMessage: null,
              checkedAt: '2026-05-15T00:00:00.000Z',
            }),
        });

        expect(
          yield* Effect.promise(() =>
            readFile(result.notarizedTransactionPath, 'utf8'),
          ),
        ).toMatch(/^[0-9a-f]+\n$/);
      }),
  );
});

const writeArtifactFixture = (
  artifactPath: string,
  input: { missingRootSignature?: boolean; withSubintent?: boolean } = {},
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
    await mkdir(artifactPath, { recursive: true });
    await writeFile(
      join(artifactPath, 'prepared.json'),
      JSON.stringify(
        {
          type: 'preparedTransaction',
          version: 1,
          transactionId,
          network: stokenet,
          intentHash: { id: 'intent', hex: 'aa' },
          manifestSourceFile: 'root.rtm',
          transactionIntentPath: 'transactionIntent.json',
          staticAnalysisPath: 'staticAnalysis.json',
          signingRequests: input.missingRootSignature
            ? ['signing-requests/root/account_rdx1.json']
            : [],
          signatureTemplates: [],
          subintentOrder: input.withSubintent ? ['child_one'] : [],
          authorizationAnalysis: {
            rootIntent: [],
            subintents: input.withSubintent ? { child_one: [] } : {},
          },
          notaryPublicKey: { curve: 'Ed25519', hex: notaryPublicKeyHex },
          notaryIsSignatory: true,
        },
        null,
        2,
      ),
      'utf8',
    );
    if (input.missingRootSignature) {
      await mkdir(join(artifactPath, 'signing-requests', 'root'), {
        recursive: true,
      });
      await writeFile(
        join(artifactPath, 'signing-requests/root/account_rdx1.json'),
        JSON.stringify(
          {
            type: 'signingRequest',
            version: 1,
            transactionId,
            scope: { kind: 'rootIntent' },
            account: 'account_rdx1',
            hash: { id: 'intent', hex: 'aa' },
            signingRequestPath: 'signing-requests/root/account_rdx1.json',
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
    await writeFile(
      join(artifactPath, 'signatures.json'),
      JSON.stringify(
        {
          type: 'signatureFile',
          version: 1,
          transactionId,
          signatures: [
            {
              scope: { kind: 'notary' },
              account: null,
              hash: { id: 'signed', hex: 'bb' },
              signingRequestPath: 'signing-requests/notary.json',
              publicKey: { curve: 'Ed25519', hex: notaryPublicKeyHex },
              signature: { curve: 'Ed25519', hex: '3'.repeat(128) },
            },
            ...(input.withSubintent
              ? [
                  {
                    scope: { kind: 'subintent', subintentId: 'child_one' },
                    account: 'account_rdx1-child',
                    hash: { id: 'subtxid_child', hex: 'bb' },
                    signingRequestPath:
                      'signing-requests/subintents/child_one/account_rdx1-child.json',
                    publicKey: { curve: 'Ed25519', hex: '2'.repeat(64) },
                    signature: { curve: 'Ed25519', hex: '3'.repeat(128) },
                  },
                ]
              : []),
          ],
        },
        null,
        2,
      ),
      'utf8',
    );
  });

const writeSubmitResultFixture = (
  artifactPath: string,
  input: { status: string; checkedAt: string },
) =>
  Effect.promise(() =>
    writeFile(
      join(artifactPath, 'submitResult.json'),
      JSON.stringify(
        {
          type: 'submitResult',
          version: 1,
          transactionId,
          networkStatus: {
            transactionId,
            status: input.status,
            statusDescription: input.status,
            errorMessage: null,
            checkedAt: input.checkedAt,
          },
          attempts: [
            {
              checkedAt: input.checkedAt,
              status: input.status,
              statusDescription: input.status,
              errorMessage: null,
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    ),
  );
