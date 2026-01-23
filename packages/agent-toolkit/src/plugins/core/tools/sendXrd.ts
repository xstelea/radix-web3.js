import type { RadixWalletClient } from '@/wallet/RadixWalletClient';
import { Chain, PluginBase, createTool } from '@goat-sdk/core';
import { manifests } from 'radix-web3.js';
import { z } from 'zod';

export const sendXRDParametersSchema = z.object({
  to: z.string().describe("The recipient's address"),
  amount: z.string().describe('The amount you want to send'),
});

export const sendXRDMethod = async (
  walletClient: RadixWalletClient,
  parameters: z.infer<typeof sendXRDParametersSchema>,
) => {
  try {
    const { to, amount } = parameters;

    const xrdAddress = await walletClient
      .getClient()
      .networkClient.getKnownAddresses()
      .then((res) => res.resourceAddresses.xrd);

    return walletClient.sendTransaction(
      manifests.sendResourceManifest({
        fromAddress: walletClient.getAddress(),
        toAddress: to,
        amount,
        resourceAddress: xrdAddress,
      }),
    );
  } catch (error) {
    throw new Error(`Failed to send XRD: ${error}`);
  }
};
