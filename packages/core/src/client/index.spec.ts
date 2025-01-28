import { describe, expect, it } from 'vitest'
import { PrivateKey } from '@radixdlt/radix-engine-toolkit'

import { deriveAccountAddressFromPublicKey } from '@/account'
import { createRadixWeb3Client } from '@/client'
import { getXrdFromFaucetManifest } from '@/manifests/getXrdFromFaucet'
import { manifests } from '@/manifests'
import { getKnownAddresses } from '@/transaction/helpers/getKnownAddresses'

const networkId = 2

const keyPair = new PrivateKey.Ed25519(
  'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
)

const keyPair2 = new PrivateKey.Ed25519(
  'faceb00cfaceb00cfaceb00cfaceb00cfaceb00cfaceb00cfaceb00cfaceb00c',
)

const accountAddress = await deriveAccountAddressFromPublicKey(
  keyPair.publicKey(),
  networkId,
)

const accountAddress2 = await deriveAccountAddressFromPublicKey(
  keyPair2.publicKey(),
  networkId,
)

const web3Client = createRadixWeb3Client({
  networkId: 'Stokenet',
  notaryPublicKey: keyPair.publicKey(),
  notarizer: (hash) => keyPair.signToSignature(hash),
})

describe('RadixWeb3Client', () => {
  describe(
    'buildTransaction',
    () => {
      it('should build, sign, notarize, and submit a transaction', async () => {
        const { response } = await web3Client.submitTransaction(
          getXrdFromFaucetManifest(accountAddress),
        )

        expect(response.status).toBe('CommittedSuccess')
      })
      it('should successfully send resources between accounts', async () => {
        const { response } = await web3Client.submitTransaction(
          manifests.sendResourceManifest({
            resourceAddress: (await getKnownAddresses(networkId))
              .resourceAddresses.xrd,
            amount: '1',
            fromAddress: accountAddress,
            toAddress: accountAddress2,
          }),
        )

        expect(response.status).toBe('CommittedSuccess')
      })

      it('should get account balances', async () => {
        const balances = await web3Client.getBalances(accountAddress)
        expect(balances).toBeDefined()
        expect(balances.fungibleTokens.some((r) => r.symbol === 'XRD')).toBe(
          true,
        )
      })
    },
    { timeout: 30000 },
  )
})
