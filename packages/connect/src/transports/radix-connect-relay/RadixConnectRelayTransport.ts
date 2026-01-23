import { createEd25519KeyPair } from '../../crypto/ed25519';
import { toHex } from '../../crypto/helpers/toHex';
import type { WalletInteraction } from '../../schemas/walletInteraction';
import type { RadixConnectTransport } from '../../types';
import {
  type RadixConnectRelayResponse,
  createRadixConnectRelayApiClient,
} from './apiClient';
import { base64urlEncode } from './helpers/base64url';
import { decryptPayload } from './helpers/decryptPayload';
import { produceSignature } from './helpers/produceSignature';

type RequestBody = {
  sessionId: string;
  request: string;
  signature: string;
  publicKey: string;
  identity: string;
  origin: string;
  dAppDefinitionAddress: string;
};

export type RadixConnectRelayTransportCtorParams = {
  baseUrl?: string;
  walletUrl?: string;
  sessionId?: string;
  privateKey?: Uint8Array;
  handleRequest: (request: {
    deepLink: string;
    body: RequestBody;
    abortController: AbortController;
  }) => Promise<void>;
};

export const createRadixConnectRelayTransport = (
  input: RadixConnectRelayTransportCtorParams,
): RadixConnectTransport => {
  const {
    baseUrl = 'https://radix-connect-relay.radixdlt.com',
    walletUrl = 'radixWallet://connect',
    sessionId = crypto.randomUUID(),
    privateKey,
    handleRequest,
  }: RadixConnectRelayTransportCtorParams = input ?? {};

  const apiClient = createRadixConnectRelayApiClient({
    baseUrl: `${baseUrl}/api/v1`,
  });

  const keyPair = createEd25519KeyPair(privateKey);

  const createDeepLink = (values: Record<string, string>) => {
    const outboundUrl = new URL(walletUrl);

    Object.entries(values).forEach(([key, value]) => {
      outboundUrl.searchParams.append(key, value);
    });

    return outboundUrl.toString();
  };

  const awaitWalletResponse = async ({ signal }: { signal: AbortSignal }) => {
    let response: RadixConnectRelayResponse[] = [];
    while (response.length === 0) {
      if (signal?.aborted) {
        throw new Error('Request aborted');
      }

      try {
        response = await apiClient.getResponses(sessionId);
      } catch (error) {
        console.error(error);
      }

      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    return response[0];
  };

  const sendRequest = async (walletInteraction: WalletInteraction) => {
    const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes timeout
    const abortController = new AbortController();

    const timeoutId = setTimeout(() => {
      abortController.abort('Request timed out after 5 minutes');
    }, TIMEOUT_MS);

    const signature = produceSignature(
      {
        dAppDefinitionAddress: walletInteraction.metadata.dAppDefinitionAddress,
        interactionId: walletInteraction.interactionId,
        origin: walletInteraction.metadata.origin,
      },
      keyPair,
    );

    const requestBody: RequestBody = {
      sessionId,
      request: base64urlEncode(walletInteraction),
      signature,
      publicKey: toHex(keyPair.x25519.publicKey),
      identity: toHex(keyPair.ed25519.publicKey),
      origin: walletInteraction.metadata.origin,
      dAppDefinitionAddress: walletInteraction.metadata.dAppDefinitionAddress,
    };

    await handleRequest({
      deepLink: createDeepLink(requestBody),
      body: requestBody,
      abortController,
    });

    const response = await awaitWalletResponse({
      signal: abortController.signal,
    });

    clearTimeout(timeoutId);

    if ('error' in response) {
      throw new Error(response.error);
    }

    const { publicKey, data: encryptedData } = response;

    const walletInteractionResponse = await decryptPayload({
      encryptedData,
      keyPair,
      salt: walletInteraction.metadata.dAppDefinitionAddress,
      publicKey,
    });

    if (
      walletInteraction.interactionId !==
      walletInteractionResponse.interactionId
    ) {
      throw new Error('Wallet interaction response does not match request');
    }

    return walletInteractionResponse;
  };

  return { sendRequest };
};
