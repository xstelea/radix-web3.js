import {
  WalletInteraction,
  WalletInteractionResponse,
} from './schemas/walletInteraction'
import { RadixConnectTransport } from './types'

export const createRadixConnectClient = ({
  transport,
}: {
  transport: RadixConnectTransport
}) => {
  const sendRequest = async (
    walletInteraction: WalletInteraction,
  ): Promise<WalletInteractionResponse> =>
    transport.sendRequest(walletInteraction)

  return {
    sendRequest,
  }
}
