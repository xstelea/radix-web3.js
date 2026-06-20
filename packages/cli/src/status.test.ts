import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, assert, describe, it, vi } from '@effect/vitest';
import { Effect, Schema } from 'effect';

import { NetworkSchema, SubmitResultSchema } from './schemas';
import {
  gatewayTransactionStatus,
  listTransactionArtifactsWithNetworkStatus,
  queryTransactionStatus,
} from './status';
import { makeTempDir } from './test-helpers';

const mainnet = NetworkSchema.make('mainnet');

describe('tx status workflow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.effect('reads transaction status from the gateway', () =>
    Effect.gen(function* () {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            intent_status: 'CommittedSuccess',
            intent_status_description: 'Committed',
            error_message: null,
          }),
          { status: 200 },
        ),
      );

      const result = yield* gatewayTransactionStatus({
        config: { network: mainnet },
        transactionId: 'txid_gateway',
      });

      const firstCall = fetchMock.mock.calls[0];
      assert.isDefined(firstCall);
      assert.strictEqual(
        firstCall?.[0],
        'https://mainnet.radixdlt.com/transaction/status',
      );
      assert.strictEqual(result.transactionId, 'txid_gateway');
      assert.strictEqual(result.status, 'CommittedSuccess');
      assert.strictEqual(result.statusDescription, 'Committed');
      assert.isNull(result.errorMessage);
    }),
  );

  it.effect('rejects malformed gateway status responses', () =>
    Effect.gen(function* () {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify([]), { status: 200 }),
      );

      const result = yield* Effect.result(
        gatewayTransactionStatus({
          config: { network: mainnet },
          transactionId: 'txid_malformed',
        }),
      );

      assert.strictEqual(result._tag, 'Failure');
      if (result._tag === 'Failure') {
        assert.strictEqual(result.failure._tag, 'TransactionStatusError');
        assert.strictEqual(result.failure.transactionId, 'txid_malformed');
      }
    }),
  );

  it.effect('queries transaction status without local artifacts', () =>
    Effect.gen(function* () {
      const artifactRoot = yield* makeTempDir('status-external');

      const result = yield* queryTransactionStatus({
        artifactRoot,
        transactionId: 'txid_external',
        getNetworkStatus: fakeStatus('CommittedSuccess'),
      });

      assert.deepInclude(result, {
        transactionId: 'txid_external',
        artifactPath: null,
        updatedSubmitResultPath: null,
      });
      assert.strictEqual(result.networkStatus.status, 'CommittedSuccess');
    }),
  );

  it.effect('updates submitResult.json when an artifact exists', () =>
    Effect.gen(function* () {
      const artifactRoot = yield* makeTempDir('status-local');
      const artifactPath = join(artifactRoot, 'txid_local');
      yield* writePreparedArtifact(artifactPath, 'txid_local');

      const result = yield* queryTransactionStatus({
        artifactRoot,
        transactionId: 'txid_local',
        getNetworkStatus: fakeStatus('CommittedFailure'),
      });

      assert.strictEqual(
        result.updatedSubmitResultPath,
        join(artifactPath, 'submitResult.json'),
      );

      const submitResultJson = yield* Effect.tryPromise(() =>
        readFile(join(artifactPath, 'submitResult.json'), 'utf8'),
      );
      const submitResult = Schema.decodeUnknownSync(SubmitResultSchema)(
        JSON.parse(submitResultJson),
      );

      assert.deepInclude(submitResult, {
        type: 'submitResult',
        transactionId: 'txid_local',
      });
      assert.strictEqual(submitResult.networkStatus.status, 'CommittedFailure');
      assert.lengthOf(submitResult.attempts, 1);
    }),
  );

  it.effect('appends status refresh attempts to existing submit results', () =>
    Effect.gen(function* () {
      const artifactRoot = yield* makeTempDir('status-append');
      const artifactPath = join(artifactRoot, 'txid_local');
      yield* writePreparedArtifact(artifactPath, 'txid_local');
      yield* writeSubmitResultArtifact(artifactPath, {
        transactionId: 'txid_local',
        status: 'Pending',
        checkedAt: '2026-05-15T00:00:00.000Z',
      });

      const result = yield* queryTransactionStatus({
        artifactRoot,
        transactionId: 'txid_local',
        getNetworkStatus: fakeStatus('CommittedSuccess'),
      });

      const submitResultJson = yield* Effect.tryPromise(() =>
        readFile(result.updatedSubmitResultPath ?? '', 'utf8'),
      );
      const submitResult = Schema.decodeUnknownSync(SubmitResultSchema)(
        JSON.parse(submitResultJson),
      );

      assert.deepEqual(
        submitResult.attempts.map((attempt) => attempt.status),
        ['Pending', 'CommittedSuccess'],
      );
    }),
  );

  it.effect('can query read-only without mutating artifacts', () =>
    Effect.gen(function* () {
      const artifactRoot = yield* makeTempDir('status-read-only');
      const artifactPath = join(artifactRoot, 'txid_local');
      yield* writePreparedArtifact(artifactPath, 'txid_local');

      const result = yield* queryTransactionStatus({
        artifactRoot,
        transactionId: 'txid_local',
        readOnly: true,
        getNetworkStatus: fakeStatus('Pending'),
      });

      assert.strictEqual(result.artifactPath, artifactPath);
      assert.isNull(result.updatedSubmitResultPath);
    }),
  );

  it.effect('lists network status read-only by default', () =>
    Effect.gen(function* () {
      const artifactRoot = yield* makeTempDir('list-network-readonly');
      const artifactPath = join(artifactRoot, 'txid_local');
      yield* writePreparedArtifact(artifactPath, 'txid_local');

      const result = yield* listTransactionArtifactsWithNetworkStatus({
        artifactRoot,
        getNetworkStatus: fakeStatus('Pending'),
      });

      assert.lengthOf(result, 1);
      const [firstResult] = result;
      assert.isDefined(firstResult);
      if (firstResult === undefined) {
        return;
      }
      assert.strictEqual(firstResult.transactionId, 'txid_local');
      assert.isDefined(firstResult.networkStatus);
      if (firstResult.networkStatus === undefined) {
        return;
      }
      assert.strictEqual(firstResult.networkStatus.status, 'Pending');
      assert.isNull(firstResult.updatedSubmitResultPath);
      const submitResultExists = yield* Effect.tryPromise(() =>
        access(join(artifactPath, 'submitResult.json'))
          .then(() => true)
          .catch(() => false),
      );
      assert.isFalse(submitResultExists);
    }),
  );

  it.effect(
    'updates artifacts when list network status update is enabled',
    () =>
      Effect.gen(function* () {
        const artifactRoot = yield* makeTempDir('list-network-update');
        const artifactPath = join(artifactRoot, 'txid_local');
        yield* writePreparedArtifact(artifactPath, 'txid_local');

        const result = yield* listTransactionArtifactsWithNetworkStatus({
          artifactRoot,
          update: true,
          getNetworkStatus: fakeStatus('CommittedSuccess'),
        });

        assert.strictEqual(
          result[0]?.updatedSubmitResultPath,
          join(artifactPath, 'submitResult.json'),
        );
        const submitResult = Schema.decodeUnknownSync(SubmitResultSchema)(
          JSON.parse(
            yield* Effect.tryPromise(() =>
              readFile(join(artifactPath, 'submitResult.json'), 'utf8'),
            ),
          ),
        );
        assert.strictEqual(
          submitResult.networkStatus.status,
          'CommittedSuccess',
        );
      }),
  );
});

const fakeStatus =
  (status: string) =>
  (transactionId: string): Effect.Effect<ReturnType<typeof statusPayload>> =>
    Effect.succeed(statusPayload(transactionId, status));

const statusPayload = (transactionId: string, status: string) => ({
  transactionId,
  status,
  statusDescription: status,
  errorMessage: null,
  checkedAt: '2026-05-15T00:00:00.000Z',
});

const writePreparedArtifact = (artifactPath: string, transactionId: string) =>
  Effect.tryPromise(async () => {
    await mkdir(artifactPath, { recursive: true });
    await writeFile(
      join(artifactPath, 'prepared.json'),
      JSON.stringify(
        {
          type: 'preparedTransaction',
          version: 1,
          transactionId,
          network: 'mainnet',
          intentHash: { id: 'intent', hex: 'aa' },
          manifestSourceFile: 'root.rtm',
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

const writeSubmitResultArtifact = (
  artifactPath: string,
  input: { transactionId: string; status: string; checkedAt: string },
) =>
  Effect.tryPromise(() =>
    writeFile(
      join(artifactPath, 'submitResult.json'),
      JSON.stringify(
        {
          type: 'submitResult',
          version: 1,
          transactionId: input.transactionId,
          networkStatus: {
            transactionId: input.transactionId,
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
