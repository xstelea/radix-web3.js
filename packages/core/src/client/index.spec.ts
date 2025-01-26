import { describe, expect, it } from 'vitest'
import { PrivateKey } from '@radixdlt/radix-engine-toolkit'

import { fromPublicKey } from '@/account'
import { createRadixWeb3Client } from '@/client'
import { getXrdFromFaucetManifest } from '@/manifests/getXrdFromFaucet'

const networkId = 2

const keyPair = new PrivateKey.Ed25519(
  'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
)

const keyPair2 = new PrivateKey.Ed25519(
  'faceb00cfaceb00cfaceb00cfaceb00cfaceb00cfaceb00cfaceb00cfaceb00c',
)

const accountAddress = await fromPublicKey(keyPair.publicKey(), networkId)

const accountAddress2 = await fromPublicKey(keyPair2.publicKey(), networkId)

describe('RadixWeb3Client', () => {
  describe('buildTransaction', () => {
    it(
      'should build, sign, notarize, and submit a transaction',
      async () => {
        const web3Client = createRadixWeb3Client({
          networkId: 'Stokenet',
          notaryPublicKey: keyPair.publicKey(),
          notarizer: (hash) => keyPair.signToSignature(hash),
        })

        // console.log(
        //   await web3Client.submitTransaction(
        //     sendResourceManifest({
        //       resourceAddress:
        //         'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc',
        //       amount: '1',
        //       fromAddress: accountAddress,
        //       toAddress: accountAddress2,
        //     }),
        //   ),
        // )

        const { response } = await web3Client.submitTransaction(
          getXrdFromFaucetManifest(accountAddress),
        )

        expect(response.status).toBe('CommittedSuccess')

        console.log(
          JSON.stringify(
            await web3Client.getBalances(
              'account_tdx_2_12xs0y59ke0du03684zq2xys3slt6ytx0qtcr4c4h07gurm4gkpcwuk',
            ),
            null,
            2,
          ),
        )
      },
      { timeout: 30000 },
    )
  })
})
