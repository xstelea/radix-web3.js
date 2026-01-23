import type {
  WalletInteraction,
  WalletInteractionResponse,
} from './schemas/walletInteraction';

export type RadixConnectTransport = {
  sendRequest: (
    walletInteraction: WalletInteraction,
  ) => Promise<WalletInteractionResponse>;
};
