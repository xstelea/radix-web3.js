import { createRadixConnectRelayTransport } from '.'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toHex } from '../../crypto/helpers/toHex'

describe('RadixConnectRelay', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('sendRequest', () => {
    it('should send request and return relay errors', async () => {
      const handleRequest = vi.fn()

      vi.stubGlobal(
        'fetch',
        async () =>
          Response.json([
            {
              sessionId: 'session-1',
              error: 'wallet rejected',
            },
          ]),
      )

      const transport = createRadixConnectRelayTransport({
        sessionId: 'session-1',
        handleRequest,
      })

      await expect(
        transport.sendRequest({
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
        }),
      ).rejects.toThrow('wallet rejected')

      expect(handleRequest).toHaveBeenCalledOnce()
      expect(handleRequest.mock.calls[0]?.[0].deepLink).toContain(
        'sessionId=session-1',
      )
    })
  })
})
