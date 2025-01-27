import {
  createRadixWeb3Client,
  manifests,
  account,
  createEd25519KeyPair,
} from 'radix-web3.js'

export const getXrdFromFaucet = {
  name: 'getXrdFromFaucet',
  procedure: async () => {
    const ed25519KeyPair = createEd25519KeyPair()

    const accountAddress = await account.fromPublicKey(
      ed25519KeyPair.publicKey(),
      2,
    )

    const client = createRadixWeb3Client({
      networkId: 'Stokenet',
      notaryPublicKey: ed25519KeyPair.publicKey(),
      notarizer: (hash) => ed25519KeyPair.signToSignature(hash),
    })

    console.log(
      await client.submitTransaction(
        manifests.getXrdFromFaucetManifest(accountAddress),
      ),
    )
  },
}
