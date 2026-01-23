import { GatewayApiClient } from '@radix-effects/gateway';
import type { TransactionStatusResponse } from '@radixdlt/babylon-gateway-api-sdk';
import { Config, Data, Duration, Effect, Schedule } from 'effect';
import type { TransactionId } from 'shared/brandedTypes';

class TransactionNotResolvedError extends Data.TaggedError(
  'TransactionNotResolvedError',
)<{
  status: TransactionStatusResponse['intent_status'];
  statusDescription: string;
  message: null | undefined | string;
  transactionId: TransactionId;
}> {}

class TransactionFailedError extends Data.TaggedError(
  'TransactionFailedError',
)<{
  status: TransactionStatusResponse['intent_status'];
  statusDescription: string;
  message: null | undefined | string;
  transactionId: TransactionId;
}> {}

class TimeoutError extends Data.TaggedError('TimeoutError')<{
  transactionId: TransactionId;
}> {}

export class TransactionStatus extends Effect.Service<TransactionStatus>()(
  'TransactionStatus',
  {
    effect: Effect.gen(function* () {
      const pollTimeoutDuration = yield* Config.duration(
        'TRANSACTION_STATUS_POLL_TIMEOUT',
      ).pipe(Config.withDefault(Duration.minutes(1)), Effect.orDie);

      const maxPollAttempts = yield* Config.number(
        'TRANSACTION_STATUS_MAX_POLL_ATTEMPTS_COUNT',
      ).pipe(Config.withDefault(10), Effect.orDie);

      const pollDelay = yield* Config.duration(
        'TRANSACTION_STATUS_POLL_DELAY',
      ).pipe(Config.withDefault(Duration.millis(100)), Effect.orDie);

      const retryPolicy = Schedule.exponential(pollDelay).pipe(
        Schedule.compose(Schedule.recurs(maxPollAttempts)),
      );

      const gatewayApiClient = yield* GatewayApiClient;

      const getTransactionStatus = (id: TransactionId) =>
        Effect.gen(function* () {
          const result =
            yield* gatewayApiClient.transaction.innerClient.transactionStatus({
              transactionStatusRequest: {
                intent_hash: id,
              },
            });

          const { intent_status } = result;

          if (intent_status === 'CommittedSuccess') return result;

          if (
            intent_status === 'CommittedFailure' ||
            intent_status === 'PermanentlyRejected'
          )
            return yield* new TransactionFailedError({
              status: intent_status,
              statusDescription: result.intent_status_description,
              message: result.error_message,
              transactionId: id,
            });

          return yield* new TransactionNotResolvedError({
            status: intent_status,
            statusDescription: result.intent_status_description,
            message: result.error_message,
            transactionId: id,
          });
        });

      return {
        poll: (input: {
          id: TransactionId;
          retryPolicy?: Schedule.Schedule<number, unknown, never>;
          timeout?: Duration.Duration;
        }) =>
          getTransactionStatus(input.id).pipe(
            Effect.tapErrorTag('TransactionFailedError', Effect.logError),
            Effect.retry({
              schedule: input.retryPolicy ?? retryPolicy,
              while: (error) => error._tag === 'TransactionNotResolvedError',
            }),
            Effect.timeout(input.timeout ?? pollTimeoutDuration),
            Effect.catchTags({
              TimeoutException: () =>
                new TimeoutError({ transactionId: input.id }),
            }),
          ),
      };
    }),
  },
) {}
