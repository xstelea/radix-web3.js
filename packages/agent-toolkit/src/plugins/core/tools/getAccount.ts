import type { Metadata, createRadixConnectClient } from 'radix-connect';
import { z } from 'zod';

export const getAccountParametersSchema = z.object({});

export const getAccountMethod = async (
  radixConnectClient: ReturnType<typeof createRadixConnectClient>,
  metadata: Metadata,
) => {
  try {
    return radixConnectClient.sendRequest({
      interactionId: crypto.randomUUID(),
      metadata,
      items: {
        discriminator: 'unauthorizedRequest',
        oneTimeAccounts: {
          numberOfAccounts: {
            quantifier: 'exactly',
            quantity: 1,
          },
        },
      },
    });
  } catch (error) {
    throw new Error(`Failed get account: ${error}`);
  }
};
