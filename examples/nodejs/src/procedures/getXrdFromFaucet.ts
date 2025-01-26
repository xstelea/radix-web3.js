import { createRadixWeb3Client } from 'radix-web3.js'
import { getXrdFromFaucetManifest } from 'radix-web3.js/manifests'
import { fromPublicKey } from 'radix-web3.js/account'
import { createEd25519KeyPair } from 'radix-web3.js/keypairs'

export const getXrdFromFaucet = {
  name: 'getXrdFromFaucet',
  procedure: async () => {
    const ed25519KeyPair = createEd25519KeyPair()

    const accountAddress = await fromPublicKey(ed25519KeyPair.publicKey(), 2)

    const client = createRadixWeb3Client({
      networkId: 'Stokenet',
      notaryPublicKey: ed25519KeyPair.publicKey(),
      notarizer: (hash) => ed25519KeyPair.signToSignature(hash),
    })

    console.log(
      await client.submitTransaction(getXrdFromFaucetManifest(accountAddress)),
    )
  },
}
