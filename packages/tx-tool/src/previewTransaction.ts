import { GatewayApiClient } from '@radix-effects/gateway';
import type { TransactionReceipt } from '@radixdlt/babylon-core-api-sdk';
import type { TransactionPreviewOperationRequest } from '@radixdlt/babylon-gateway-api-sdk';
import { Context, Data, Effect, Layer } from 'effect';

class TransactionPreviewError extends Data.TaggedError(
  'TransactionPreviewError',
)<{
  message?: string;
}> {}

export class PreviewTransaction extends Context.Service<PreviewTransaction>()(
  '@radix-effects/tx-tool/PreviewTransaction',
  {
    make: Effect.gen(function* () {
      const gatewayApiClient = yield* GatewayApiClient;

      return (input: {
        payload: TransactionPreviewOperationRequest['transactionPreviewRequest'];
      }) =>
        Effect.gen(function* () {
          const result =
            yield* gatewayApiClient.transaction.innerClient.transactionPreview({
              transactionPreviewRequest: input.payload,
            });

          const receipt = result.receipt as TransactionReceipt;

          if (receipt.status !== 'Succeeded')
            return yield* new TransactionPreviewError({
              message: receipt.error_message,
            });

          return result;
        });
    }),
  },
) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies;
}
