import { GatewayApiClient } from '@radix-effects/gateway';
import { HexString } from '@radix-effects/shared';
import { Convert } from '@steleaio/radix-engine-toolkit';
import { Context, Effect, Layer, pipe } from 'effect';

export class SubmitTransaction extends Context.Service<SubmitTransaction>()(
  '@radix-effects/tx-tool/SubmitTransaction',
  {
    make: Effect.gen(function* () {
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
) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies;
}
