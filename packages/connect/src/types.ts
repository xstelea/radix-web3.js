import {
  WalletInteractionResponse,
  WalletInteraction,
} from './schemas/walletInteraction'

export type RadixConnectTransport = {
  sendRequest: (
    walletInteraction: WalletInteraction,
  ) => Promise<WalletInteractionResponse>
}
