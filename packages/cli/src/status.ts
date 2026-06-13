import { join } from 'node:path';

import { Data, Effect, Schema } from 'effect';

import {
  type TransactionArtifactSummary,
  findTransactionArtifactOption,
  listTransactionArtifacts,
  writeSubmitResult,
} from './artifacts';
import type { Network, ResolvedRdxConfig } from './config';
import { gatewayErrorMessage } from './gatewayHttp';
import { readJsonFile } from './platformIo';
import {
  type ArtifactStatus,
  type NetworkTransactionStatus,
  type PreparedTransaction,
  type SubmitResult,
  SubmitResultSchema,
} from './schemas';

export class TransactionStatusError extends Data.TaggedError(
  'TransactionStatusError',
)<{
  transactionId: string;
  reason: unknown;
}> {}

export type TransactionStatusResult = {
  transactionId: string;
  artifactPath: string | null;
  networkStatus: NetworkTransactionStatus;
  updatedSubmitResultPath: string | null;
};

const gatewayBaseUrl = (network: Network) =>
  network === 'stokenet'
    ? 'https://stokenet.radixdlt.com'
    : 'https://mainnet.radixdlt.com';

const readExistingSubmitResult = (artifactPath: string) =>
  readJsonFile(
    join(artifactPath, 'submitResult.json'),
    (reason) => reason,
  ).pipe(
    Effect.flatMap(Schema.decodeUnknown(SubmitResultSchema)),
    Effect.catchAll(() => Effect.succeed(undefined)),
  );

export const gatewayTransactionStatus = (input: {
  config: Pick<ResolvedRdxConfig, 'network' | 'gatewayBaseUrl'>;
  transactionId: string;
}): Effect.Effect<NetworkTransactionStatus, TransactionStatusError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(
        `${input.config.gatewayBaseUrl ?? gatewayBaseUrl(input.config.network)}/transaction/status`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ intent_hash: input.transactionId }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await Effect.runPromise(
            gatewayErrorMessage('Gateway status', response),
          ),
        );
      }

      const body = (await response.json()) as {
        intent_status?: string;
        intent_status_description?: string;
        error_message?: string | null;
      };

      return {
        transactionId: input.transactionId,
        status: body.intent_status ?? 'Unknown',
        statusDescription: body.intent_status_description ?? '',
        errorMessage: body.error_message ?? null,
        checkedAt: new Date().toISOString(),
      };
    },
    catch: (reason) =>
      new TransactionStatusError({
        transactionId: input.transactionId,
        reason,
      }),
  });

export const queryTransactionStatus = (input: {
  artifactRoot: string;
  transactionId: string;
  readOnly?: boolean;
  getNetworkStatus: (
    transactionId: string,
  ) => Effect.Effect<NetworkTransactionStatus, unknown>;
}): Effect.Effect<TransactionStatusResult, unknown> =>
  Effect.gen(function* () {
    const artifactPath = yield* findTransactionArtifactOption({
      artifactRoot: input.artifactRoot,
      transactionId: input.transactionId,
    });
    const networkStatus = yield* input.getNetworkStatus(input.transactionId);

    if (!artifactPath || input.readOnly) {
      return {
        transactionId: input.transactionId,
        artifactPath: artifactPath ?? null,
        networkStatus,
        updatedSubmitResultPath: null,
      };
    }

    const existingSubmitResult = yield* readExistingSubmitResult(artifactPath);
    const submitResult: SubmitResult = {
      type: 'submitResult',
      version: 1,
      transactionId: input.transactionId,
      networkStatus,
      attempts: [
        ...(existingSubmitResult?.attempts ?? []),
        {
          checkedAt: networkStatus.checkedAt,
          status: networkStatus.status,
          statusDescription: networkStatus.statusDescription,
          errorMessage: networkStatus.errorMessage,
        },
      ],
    };
    const updatedSubmitResultPath = yield* writeSubmitResult({
      artifactPath,
      submitResult,
    });

    return {
      transactionId: input.transactionId,
      artifactPath,
      networkStatus,
      updatedSubmitResultPath,
    };
  });

export const listTransactionArtifactsWithNetworkStatus = (input: {
  artifactRoot: string;
  pattern?: string;
  regex?: string;
  network?: PreparedTransaction['network'];
  status?: ArtifactStatus;
  update?: boolean;
  getNetworkStatus: (
    transactionId: string,
  ) => Effect.Effect<NetworkTransactionStatus, unknown>;
}): Effect.Effect<TransactionArtifactSummary[], unknown> =>
  Effect.gen(function* () {
    const artifacts = yield* listTransactionArtifacts({
      artifactRoot: input.artifactRoot,
      pattern: input.pattern,
      regex: input.regex,
      network: input.network,
      status: input.status,
    });

    return yield* Effect.all(
      artifacts.map((artifact) =>
        queryTransactionStatus({
          artifactRoot: input.artifactRoot,
          transactionId: artifact.transactionId,
          readOnly: !input.update,
          getNetworkStatus: input.getNetworkStatus,
        }).pipe(
          Effect.map((statusResult) => ({
            ...artifact,
            networkStatus: statusResult.networkStatus,
            updatedSubmitResultPath: statusResult.updatedSubmitResultPath,
          })),
        ),
      ),
    );
  });

export class StatusLifecycle extends Effect.Service<StatusLifecycle>()(
  'StatusLifecycle',
  {
    sync: () => ({
      queryTransactionStatus,
      listTransactionArtifactsWithNetworkStatus,
      gatewayTransactionStatus,
    }),
  },
) {}
