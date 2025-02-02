import { Hex } from '@noble/curves/abstract/utils'
import { x25519, ed25519 } from '@noble/curves/ed25519'
import { hkdf } from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha256'

export type Ed25519KeyPair = ReturnType<typeof createEd25519KeyPair>

export const createEd25519KeyPair = (
  privateKey = x25519.utils.randomPrivateKey(),
) => {
  const ed25519Api = {
    privateKey,
    publicKey: ed25519.getPublicKey(privateKey),
    sign: (messageHash: Hex) => ed25519.sign(messageHash, privateKey),
  } as const

  const x25519Api = {
    privateKey,
    publicKey: x25519.getPublicKey(privateKey),
    calculateSharedSecret: (input: {
      publicKey: Hex
      salt: Uint8Array
      context: string
      length: number
    }) =>
      hkdf(
        sha256,
        x25519.getSharedSecret(privateKey, input.publicKey),
        input.salt,
        input.context,
        input.length,
      ),
  } as const

  return { ed25519: ed25519Api, x25519: x25519Api } as const
}
