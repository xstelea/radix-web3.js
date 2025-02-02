import { PluginBase, createTool } from '@goat-sdk/core'
import { RadixWalletClient } from '@/wallet/RadixWalletClient'
import { z } from 'zod'
import { sendXRDMethod } from './tools/sendXrd'
import { sendXRDParametersSchema } from './tools/sendXrd'

export class RadixCorePlugin extends PluginBase<RadixWalletClient> {
  constructor() {
    super('radix-core', [])
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
      // Implement the method
      (parameters: z.infer<typeof sendXRDParametersSchema>) =>
        sendXRDMethod(walletClient, parameters),
    )

    return [sendTool]
  }
}
