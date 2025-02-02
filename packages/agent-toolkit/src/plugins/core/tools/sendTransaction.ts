import { z } from 'zod'
import { createRadixConnectClient, Metadata } from 'radix-connect'

export const sendTransactionParametersSchema = z.object({
  transactionManifest: z.string(),
})

export const sendTransactionMethod = async (
  parameters: z.infer<typeof sendTransactionParametersSchema>,
  radixConnectClient: ReturnType<typeof createRadixConnectClient>,
  metadata: Metadata,
) => {
  try {
    return radixConnectClient.sendRequest({
      interactionId: crypto.randomUUID(),
      metadata,
      items: {
        discriminator: 'transaction',
        send: {
          version: 1,
          transactionManifest: parameters.transactionManifest,
        },
      },
    })
  } catch (error) {
    throw new Error(`Failed to send transaction: ${error}`)
  }
}
