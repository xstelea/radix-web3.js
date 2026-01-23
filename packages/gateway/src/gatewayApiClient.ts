import {
  type AccountLockerNotFoundError as AccountLockerNotFoundErrorSdk,
  type EntityNotFoundError as EntityNotFoundErrorSdk,
  type ErrorResponse as ErrorResponseSdk,
  GatewayApiClient as GatewayApiClientSdk,
  type InternalServerError as InternalServerErrorSdk,
  type InvalidEntityError as InvalidEntityErrorSdk,
  type InvalidRequestError as InvalidRequestErrorSdk,
  type InvalidTransactionError as InvalidTransactionErrorSdk,
  type NotSyncedUpError as NotSyncedUpErrorSdk,
  ResponseError as ResponseErrorSdk,
  type TransactionNotFoundError as TransactionNotFoundErrorSdk,
} from '@radixdlt/babylon-gateway-api-sdk';
import { Config, Data, Duration, Effect } from 'effect';

export class AccountLockerNotFoundError extends Data.TaggedError(
  'AccountLockerNotFoundError',
)<AccountLockerNotFoundErrorSdk & { code?: number; message?: string }> {}

export class InternalServerError extends Data.TaggedError(
  'InternalServerError',
)<InternalServerErrorSdk & { code?: number; message?: string }> {}

export class InvalidRequestError extends Data.TaggedError(
  'InvalidRequestError',
)<InvalidRequestErrorSdk & { code?: number; message?: string }> {}

export class InvalidEntityError extends Data.TaggedError('InvalidEntityError')<
  InvalidEntityErrorSdk & { code?: number; message?: string }
> {}

export class EntityNotFoundError extends Data.TaggedError(
  'EntityNotFoundError',
)<EntityNotFoundErrorSdk & { code?: number; message?: string }> {}

export class NotSyncedUpError extends Data.TaggedError('NotSyncedUpError')<
  NotSyncedUpErrorSdk & { code?: number; message?: string }
> {}

export class TransactionNotFoundError extends Data.TaggedError(
  'TransactionNotFoundError',
)<TransactionNotFoundErrorSdk & { code?: number; message?: string }> {}

export class InvalidTransactionError extends Data.TaggedError(
  'InvalidTransactionError',
)<InvalidTransactionErrorSdk & { code?: number; message?: string }> {}

export class ResponseError extends Data.TaggedError(
  'ResponseError',
)<ResponseErrorSdk> {}

export class ErrorResponse extends Data.TaggedError(
  'ErrorResponse',
)<ErrorResponseSdk> {}

export class RateLimitExceededError extends Data.TaggedError(
  'RateLimitExceededError',
)<{ code: number; message: string; retryAfter: number }> {}

export class UnknownGatewayError extends Data.TaggedError(
  'UnknownGatewayError',
)<{
  error: unknown;
}> {}

export class GatewayApiClient extends Effect.Service<GatewayApiClient>()(
  'GatewayApiClient',
  {
    effect: Effect.gen(function* () {
      const networkId = yield* Config.number('NETWORK_ID')
        .pipe(Config.withDefault(1))
        .pipe(Effect.orDie);
      const basePath = yield* Config.string('GATEWAY_URL')
        .pipe(Config.withDefault(undefined))
        .pipe(Effect.orDie);
      const applicationName = yield* Config.string('APPLICATION_NAME')
        .pipe(Config.withDefault('@radix-effects/gateway'))
        .pipe(Effect.orDie);
      const gatewayApiKey = yield* Config.string('GATEWAY_BASIC_AUTH')
        .pipe(Config.withDefault(undefined))
        .pipe(Effect.orDie);

      const gatewayApiClient = GatewayApiClientSdk.initialize({
        networkId,
        basePath,
        applicationName,
        headers: gatewayApiKey
          ? { Authorization: `Basic ${gatewayApiKey}` }
          : undefined,
      });

      // Wrapper methods that return Effect instances
      const wrapMethod = <TArgs extends unknown[], TResult>(
        fn: (...args: TArgs) => Promise<TResult>,
      ) => {
        return (...args: TArgs) =>
          Effect.tryPromise({
            try: () => fn(...args),
            catch: (error) => {
              if (
                typeof error === 'object' &&
                error !== null &&
                'name' in error
              ) {
                if (error instanceof ResponseErrorSdk) {
                  if (error.errorResponse) {
                    switch (error.errorResponse.details?.type) {
                      case 'AccountLockerNotFoundError':
                        return new AccountLockerNotFoundError({
                          ...error.errorResponse.details,
                          code: error.errorResponse.code,
                          message: error.message,
                        });
                      case 'InvalidRequestError':
                        return new InvalidRequestError({
                          ...error.errorResponse.details,
                          code: error.errorResponse.code,
                          message: error.message,
                        });
                      case 'EntityNotFoundError':
                        return new EntityNotFoundError({
                          ...error.errorResponse.details,
                          code: error.errorResponse.code,
                          message: error.message,
                        });
                      case 'InternalServerError':
                        return new InternalServerError({
                          ...error.errorResponse.details,
                          code: error.errorResponse.code,
                          message: error.message,
                        });
                      case 'InvalidEntityError':
                        return new InvalidEntityError({
                          ...error.errorResponse.details,
                          code: error.errorResponse.code,
                          message: error.message,
                        });
                      case 'InvalidTransactionError':
                        return new InvalidTransactionError({
                          ...error.errorResponse.details,
                          code: error.errorResponse.code,
                          message: error.message,
                        });
                      case 'NotSyncedUpError':
                        return new NotSyncedUpError({
                          ...error.errorResponse.details,
                          code: error.errorResponse.code,
                          message: error.message,
                        });
                      case 'TransactionNotFoundError':
                        return new TransactionNotFoundError({
                          ...error.errorResponse.details,
                          code: error.errorResponse.code,
                          message: error.message,
                        });
                    }

                    return new ErrorResponse(error.errorResponse);
                  }
                  if (error.fetchResponse.status === 429) {
                    return new RateLimitExceededError({
                      code: error.fetchResponse.status,
                      message: error.fetchResponse.statusText,
                      retryAfter: Number.parseInt(
                        error.fetchResponse.headers.get('retry-after') ?? '0',
                      ),
                    });
                  }
                  return new ResponseError(error);
                }
              }

              return new UnknownGatewayError({ error });
            },
          }).pipe(
            Effect.tapError((error) =>
              Effect.gen(function* () {
                if (error._tag === 'RateLimitExceededError') {
                  yield* Effect.logWarning(
                    `Rate limit exceeded, retrying in ${error.retryAfter} seconds`,
                  );
                  yield* Effect.sleep(Duration.seconds(error.retryAfter));
                }
              }),
            ),
            Effect.retry({
              while: (error) => error._tag === 'RateLimitExceededError',
            }),
          );
      };

      return {
        networkId,
        // State API methods
        state: {
          getEntityDetailsVaultAggregated: wrapMethod(
            gatewayApiClient.state.getEntityDetailsVaultAggregated.bind(
              gatewayApiClient.state,
            ),
          ),
          getValidators: wrapMethod(
            gatewayApiClient.state.getValidators.bind(gatewayApiClient.state),
          ),
          // InnerClient state methods
          innerClient: {
            stateEntityDetails: wrapMethod(
              gatewayApiClient.state.innerClient.stateEntityDetails.bind(
                gatewayApiClient.state.innerClient,
              ),
            ),
            entityFungiblesPage: wrapMethod(
              gatewayApiClient.state.innerClient.entityFungiblesPage.bind(
                gatewayApiClient.state.innerClient,
              ),
            ),
            entityNonFungiblesPage: wrapMethod(
              gatewayApiClient.state.innerClient.entityNonFungiblesPage.bind(
                gatewayApiClient.state.innerClient,
              ),
            ),
            entityNonFungibleIdsPage: wrapMethod(
              gatewayApiClient.state.innerClient.entityNonFungibleIdsPage.bind(
                gatewayApiClient.state.innerClient,
              ),
            ),
            entityNonFungibleResourceVaultPage: wrapMethod(
              gatewayApiClient.state.innerClient.entityNonFungibleResourceVaultPage.bind(
                gatewayApiClient.state.innerClient,
              ),
            ),
            keyValueStoreKeys: wrapMethod(
              gatewayApiClient.state.innerClient.keyValueStoreKeys.bind(
                gatewayApiClient.state.innerClient,
              ),
            ),
            keyValueStoreData: wrapMethod(
              gatewayApiClient.state.innerClient.keyValueStoreData.bind(
                gatewayApiClient.state.innerClient,
              ),
            ),
            nonFungibleData: wrapMethod(
              gatewayApiClient.state.innerClient.nonFungibleData.bind(
                gatewayApiClient.state.innerClient,
              ),
            ),
            nonFungibleLocation: wrapMethod(
              gatewayApiClient.state.innerClient.nonFungibleLocation.bind(
                gatewayApiClient.state.innerClient,
              ),
            ),
            nonFungibleIds: wrapMethod(
              gatewayApiClient.state.innerClient.nonFungibleIds.bind(
                gatewayApiClient.state.innerClient,
              ),
            ),
          },
        },
        // Stream API methods
        stream: {
          innerClient: {
            streamTransactions: wrapMethod(
              gatewayApiClient.stream.innerClient.streamTransactions.bind(
                gatewayApiClient.stream.innerClient,
              ),
            ),
          },
        },
        // Transaction API methods
        transaction: {
          getCommittedDetails: wrapMethod(
            gatewayApiClient.transaction.getCommittedDetails.bind(
              gatewayApiClient.transaction,
            ),
          ),
          innerClient: {
            transactionSubmit: wrapMethod(
              gatewayApiClient.transaction.innerClient.transactionSubmit.bind(
                gatewayApiClient.transaction.innerClient,
              ),
            ),
            transactionStatus: wrapMethod(
              gatewayApiClient.transaction.innerClient.transactionStatus.bind(
                gatewayApiClient.transaction.innerClient,
              ),
            ),
            transactionPreview: wrapMethod(
              gatewayApiClient.transaction.innerClient.transactionPreview.bind(
                gatewayApiClient.transaction.innerClient,
              ),
            ),
          },
        },
        // Status API methods
        status: {
          getCurrent: wrapMethod(
            gatewayApiClient.status.getCurrent.bind(gatewayApiClient.status),
          ),
          innerClient: {
            gatewayStatus: wrapMethod(
              gatewayApiClient.status.innerClient.gatewayStatus.bind(
                gatewayApiClient.status.innerClient,
              ),
            ),
          },
        },
        // Extensions API methods
        extensions: {
          getResourceHolders: wrapMethod(
            gatewayApiClient.extensions.getResourceHolders.bind(
              gatewayApiClient.extensions,
            ),
          ),
        },
        // Get raw client for any methods not wrapped
        rawClient: gatewayApiClient,
      };
    }),
  },
) {}
