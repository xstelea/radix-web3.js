import type { TransactionReceipt } from '@radixdlt/babylon-core-api-sdk';
import type {
  TransactionPreviewOperationRequest,
  TransactionPreviewV2OperationRequest,
} from '@radixdlt/babylon-gateway-api-sdk';
import { Context, Data, Effect, Layer } from 'effect';

import { GatewayApiClient } from './gatewayApiClient';

export class TransactionPreviewError extends Data.TaggedError(
  'TransactionPreviewError',
)<{
  message?: string;
}> {}

export class PreviewTransaction extends Context.Service<PreviewTransaction>()(
  'PreviewTransaction',
  {
    make: Effect.gen(function* () {
      const gatewayApiClient = yield* GatewayApiClient;

      return Effect.fn('PreviewTransaction')(function* (input: {
        payload: TransactionPreviewOperationRequest['transactionPreviewRequest'];
      }) {
        const result =
          yield* gatewayApiClient.transaction.innerClient.transactionPreview({
            transactionPreviewRequest: input.payload,
          });

        const receipt = result.receipt as TransactionReceipt;

        if (receipt.status !== 'Succeeded')
          return yield* new TransactionPreviewError({
            message: receipt.error_message,
          });

        return { ...result, receipt };
      });
    }),
  },
) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(GatewayApiClient.Default),
  );
}

export class PreviewTransactionV2 extends Context.Service<PreviewTransactionV2>()(
  'PreviewTransactionV2',
  {
    make: Effect.gen(function* () {
      const gatewayApiClient = yield* GatewayApiClient;

      return Effect.fn('PreviewTransactionV2')(function* (input: {
        payload: TransactionPreviewV2OperationRequest['transactionPreviewV2Request'];
      }) {
        const result =
          yield* gatewayApiClient.transaction.innerClient.transactionPreviewV2({
            transactionPreviewV2Request: input.payload,
          });

        const receipt = result.receipt
          ? (result.receipt as TransactionReceipt)
          : undefined;

        if (result.receipt) {
          if (receipt?.status !== 'Succeeded')
            return yield* new TransactionPreviewError({
              message: receipt?.error_message,
            });
        }

        return { ...result, receipt };
      });
    }),
  },
) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(GatewayApiClient.Default),
  );
}
