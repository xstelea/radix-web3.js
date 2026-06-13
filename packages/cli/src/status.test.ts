import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { it } from '@effect/vitest';
import { Effect, Schema } from 'effect';
import { describe, expect } from 'vitest';

import { SubmitResultSchema } from './schemas';
import {
  listTransactionArtifactsWithNetworkStatus,
  queryTransactionStatus,
} from './status';
import { makeTempDir } from './test-helpers';

describe('tx status workflow', () => {
  it.effect('queries transaction status without local artifacts', () =>
    Effect.gen(function* () {
      const artifactRoot = yield* makeTempDir('status-external');

      const result = yield* queryTransactionStatus({
        artifactRoot,
        transactionId: 'txid_external',
        getNetworkStatus: fakeStatus('CommittedSuccess'),
      });

      expect(result).toMatchObject({
        transactionId: 'txid_external',
        artifactPath: null,
        updatedSubmitResultPath: null,
        networkStatus: {
          status: 'CommittedSuccess',
        },
      });
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

      expect(result.updatedSubmitResultPath).toBe(
        join(artifactPath, 'submitResult.json'),
      );

      const submitResultJson = yield* Effect.promise(() =>
        readFile(join(artifactPath, 'submitResult.json'), 'utf8'),
      );
      const submitResult = Schema.decodeUnknownSync(SubmitResultSchema)(
        JSON.parse(submitResultJson),
      );

      expect(submitResult).toMatchObject({
        type: 'submitResult',
        transactionId: 'txid_local',
        networkStatus: {
          status: 'CommittedFailure',
        },
      });
      expect(submitResult.attempts).toHaveLength(1);
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

      const submitResultJson = yield* Effect.promise(() =>
        readFile(result.updatedSubmitResultPath ?? '', 'utf8'),
      );
      const submitResult = Schema.decodeUnknownSync(SubmitResultSchema)(
        JSON.parse(submitResultJson),
      );

      expect(submitResult.attempts.map((attempt) => attempt.status)).toEqual([
        'Pending',
        'CommittedSuccess',
      ]);
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

      expect(result.artifactPath).toBe(artifactPath);
      expect(result.updatedSubmitResultPath).toBe(null);
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

      expect(result).toMatchObject([
        {
          transactionId: 'txid_local',
          networkStatus: { status: 'Pending' },
          updatedSubmitResultPath: null,
        },
      ]);
      const submitResultExists = yield* Effect.promise(() =>
        access(join(artifactPath, 'submitResult.json'))
          .then(() => true)
          .catch(() => false),
      );
      expect(submitResultExists).toBe(false);
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

        expect(result[0]?.updatedSubmitResultPath).toBe(
          join(artifactPath, 'submitResult.json'),
        );
        const submitResult = Schema.decodeUnknownSync(SubmitResultSchema)(
          JSON.parse(
            yield* Effect.promise(() =>
              readFile(join(artifactPath, 'submitResult.json'), 'utf8'),
            ),
          ),
        );
        expect(submitResult.networkStatus.status).toBe('CommittedSuccess');
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
  Effect.promise(async () => {
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
  Effect.promise(() =>
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
