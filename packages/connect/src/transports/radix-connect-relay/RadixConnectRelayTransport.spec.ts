import { createRadixConnectRelayTransport } from '.'
import { describe, it } from 'vitest'
import qrcode from 'qrcode-terminal'
import { toHex } from '../../crypto/helpers/toHex'

describe('RadixConnectRelay', () => {
  describe('sendRequest', () => {
    it(
      'should send request and return response',
      { timeout: 300_000 },
      async () => {
        const transport = createRadixConnectRelayTransport({
          handleRequest: async ({ deepLink }) => {
            console.log(deepLink)
            qrcode.setErrorLevel('L')
            qrcode.generate(deepLink, { small: true })
          },
        })

        const response = await transport.sendRequest({
          interactionId: crypto.randomUUID(),
          metadata: {
            version: 2,
            networkId: 1,
            dAppDefinitionAddress:
              'account_rdx12x0xfz2yumu2qsh6yt0v8xjfc7et04vpsz775kc3yd3xvle4w5d5k5',
            origin: 'https://dashboard.radixdlt.com',
          },
          items: {
            discriminator: 'authorizedRequest',
            auth: {
              discriminator: 'loginWithChallenge',
              challenge: toHex(crypto.getRandomValues(new Uint8Array(32))),
            },
          },
        })

        console.log(JSON.stringify(response, null, 2))
      },
    )
  })
})
