import type {
  GatewayApiClient,
  TransactionStatusResponse,
} from '@radixdlt/babylon-gateway-api-sdk';

const defaultHandler = (
  response: TransactionStatusResponse,
): VerifyTransactionOutput => {
  switch (response.intent_status) {
    case 'CommittedSuccess':
      return {
        shouldSubmitTransaction: false,
        shouldPollTransaction: false,
      };
    case 'Pending':
    case 'CommitPendingOutcomeUnknown':
    case 'LikelyButNotCertainRejection':
    case 'Unknown':
      return {
        shouldSubmitTransaction: false,
        shouldPollTransaction: true,
      };

    case 'CommittedFailure':
    case 'PermanentlyRejected':
      return {
        shouldSubmitTransaction: true,
        shouldPollTransaction: false,
      };

    default:
      return {
        shouldSubmitTransaction: false,
        shouldPollTransaction: false,
      };
  }
};

type VerifyTransactionOutput = {
  shouldSubmitTransaction: boolean;
  shouldPollTransaction: boolean;
};

export type VerifyTransactionHandler = (
  response: TransactionStatusResponse,
) => VerifyTransactionOutput | undefined;

export type VerifyTransaction = ReturnType<typeof VerifyTransaction>;

export const VerifyTransaction =
  (gatewayApi: GatewayApiClient, handlers: VerifyTransactionHandler[]) =>
  async (transactionId: string) => {
    try {
      const response = await gatewayApi.transaction.getStatus(transactionId);

      for (const handler of handlers) {
        const result = handler(response);
        if (result) return { ...result, status: response.intent_status };
      }

      return { ...defaultHandler(response), status: response.intent_status };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'details' in error &&
        error.details !== null &&
        typeof error.details === 'object'
      ) {
        switch ((error.details as { type?: string }).type) {
          case 'NotSyncedUpError':
          case 'InternalServerError':
            return {
              shouldSubmitTransaction: false,
              shouldPollTransaction: true,
            };

          case 'AccountLockerNotFoundError':
          case 'EntityNotFoundError':
          case 'InvalidEntityError':
          case 'InvalidRequestError':
          case 'InvalidTransactionError':
          case 'TransactionNotFoundError':
            return {
              shouldSubmitTransaction: false,
              shouldPollTransaction: false,
            };
        }
      }
      throw error;
    }
  };
