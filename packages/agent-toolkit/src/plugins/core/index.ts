import { PluginBase, createTool } from '@goat-sdk/core'
import { RadixWalletClient } from '@/wallet/RadixWalletClient'
import { z } from 'zod'
import { sendXRDMethod } from './tools/sendXrd'
import { sendXRDParametersSchema } from './tools/sendXrd'
import { createRadixConnectClient, Metadata } from 'radix-connect'
import {
  getAccountMethod,
  getAccountParametersSchema,
} from './tools/getAccount'
import { sendTransactionMethod } from './tools/sendTransaction'
import { sendTransactionParametersSchema } from './tools/sendTransaction'

export class RadixCorePlugin extends PluginBase<RadixWalletClient> {
  private radixConnectClient: ReturnType<typeof createRadixConnectClient>
  private metadata: Metadata

  constructor(input: {
    radixConnectClient: ReturnType<typeof createRadixConnectClient>
    metadata: Metadata
  }) {
    super('radix-core', [])
    this.radixConnectClient = input.radixConnectClient
    this.metadata = input.metadata
  }

  // @ts-expect-error: will be available once https://github.com/goat-sdk/goat/pull/293 is merged
  supportsChain = (chain: Chain) => chain.type === 'radix'

  getTools(walletClient: RadixWalletClient): ReturnType<typeof createTool>[] {
    const sendTool = createTool(
      {
        name: 'send_xrd',
        description: 'Send xrd to an address.',
        parameters: sendXRDParametersSchema,
      },
      (parameters: z.infer<typeof sendXRDParametersSchema>) =>
        sendXRDMethod(walletClient, parameters),
    )

    const getAccountTool = createTool(
      {
        name: 'get_account',
        description: 'Get account from radix wallet.',
        parameters: getAccountParametersSchema,
      },
      (parameters: z.infer<typeof getAccountParametersSchema>) =>
        getAccountMethod(this.radixConnectClient, this.metadata),
    )

    const sendTransactionTool = createTool(
      {
        name: 'send_transaction_manifest',
        description: 'Send transaction manifest to the radix wallet.',
        parameters: sendTransactionParametersSchema,
      },
      (parameters: z.infer<typeof sendTransactionParametersSchema>) =>
        sendTransactionMethod(
          parameters,
          this.radixConnectClient,
          this.metadata,
        ),
    )

    return [sendTool, getAccountTool, sendTransactionTool]
  }
}
