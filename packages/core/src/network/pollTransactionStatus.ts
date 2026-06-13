import type { TransactionStatusResponse } from '@radixdlt/babylon-gateway-api-sdk';

type TransactionStatusResponseLike = Pick<
  TransactionStatusResponse,
  'intent_status'
>;

export type TransactionStatusGateway<
  TStatus extends TransactionStatusResponseLike = TransactionStatusResponse,
> = {
  transaction: {
    getStatus: (transactionId: string) => Promise<TStatus>;
  };
};

export type PollTransactionStatusOptions = Partial<{
  abortSignal: AbortSignal;
  baseDelay: number;
  maxRetries: number;
  maxDelay: number;
  delayFn: (retry: number) => number;
}>;

const pollingAbortedError = () => new Error('Transaction polling was aborted');

const sleep = (
  delay: number,
  abortSignal: AbortSignal | undefined,
): Promise<void> =>
  new Promise((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(pollingAbortedError());
      return;
    }

    const timeout = setTimeout(resolve, delay);

    abortSignal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        reject(pollingAbortedError());
      },
      { once: true },
    );
  });

export const pollTransactionStatusFactory =
  <TStatus extends TransactionStatusResponseLike = TransactionStatusResponse>(
    gatewayApiClient: TransactionStatusGateway<TStatus>,
  ) =>
  async (
    transactionId: string,
    options?: PollTransactionStatusOptions,
  ): Promise<TStatus> => {
    const {
      abortSignal,
      baseDelay = 1000,
      maxRetries = 10,
      maxDelay = 10000,
      delayFn = (retry: number) => Math.min(baseDelay * 2 ** retry, maxDelay),
    } = options || {};

    if (abortSignal?.aborted) {
      throw pollingAbortedError();
    }

    let retry = 0;

    while (retry < maxRetries) {
      const response =
        await gatewayApiClient.transaction.getStatus(transactionId);

      if (response.intent_status !== 'Pending') {
        return response;
      }

      const delay = delayFn(retry);
      retry = retry + 1;
      await sleep(delay, abortSignal);
    }

    throw new Error('Transaction polling timed out');
  };
