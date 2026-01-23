import { GatewayApiClient } from '@radix-effects/gateway';
import { Convert } from '@radixdlt/radix-engine-toolkit';
import { Effect, pipe } from 'effect';
import { HexString } from '@radix-effects/shared';

export class SubmitTransaction extends Effect.Service<SubmitTransaction>()(
  'SubmitTransaction',
  {
    effect: Effect.gen(function* () {
      const gatewayApiClient = yield* GatewayApiClient;

      return (input: { compiledTransaction: Uint8Array<ArrayBufferLike> }) =>
        Effect.gen(function* () {
          const notarizedTransactionHex = pipe(
            input.compiledTransaction,
            Convert.Uint8Array.toHexString,
            HexString.make,
          );

          return yield* gatewayApiClient.transaction.innerClient.transactionSubmit(
            {
              transactionSubmitRequest: {
                notarized_transaction_hex: notarizedTransactionHex,
              },
            },
          );
        });
    }),
  },
) {}
