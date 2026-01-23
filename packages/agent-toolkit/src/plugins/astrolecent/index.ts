import type { RadixWalletClient } from '@/wallet/RadixWalletClient';
import type { createTool } from '@goat-sdk/core';
import { PluginBase } from '@goat-sdk/core';
import { getTokenPricesTool } from './tools/getTokenPricesTool';
import { swapTokensTool } from './tools/swapTool';

export class AstrolecentPlugin extends PluginBase<RadixWalletClient> {
  constructor() {
    super('astrolecent', []);
  }

  // @ts-expect-error
  supportsChain = (chain: Chain) => chain.type === 'radix';

  getTools(): ReturnType<typeof createTool>[] {
    return [getTokenPricesTool, swapTokensTool];
  }
}
