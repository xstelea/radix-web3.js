import type { GatewayApiClient } from '@radixdlt/babylon-gateway-api-sdk';
import { type Bytes, Convert } from '@radixdlt/radix-engine-toolkit';

/**
 * Submits a compiled transaction to the network
 * @param compiledTransaction - The compiled transaction as a hexadecimal string
 * @returns A Promise that resolves to the transaction submission response from the gateway
 */
export const submitTransactionFactory =
  (gatewayApiClient: GatewayApiClient) => (compiledTransaction: Bytes) =>
    gatewayApiClient.transaction.innerClient.transactionSubmit({
      transactionSubmitRequest: {
        notarized_transaction_hex:
          typeof compiledTransaction === 'string'
            ? compiledTransaction
            : Convert.Uint8Array.toHexString(compiledTransaction),
      },
    });
