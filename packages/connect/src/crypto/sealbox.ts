import { concatBytes } from '@noble/hashes/utils'

export type SealedBoxProps = {
  iv: Uint8Array
  authTag: Uint8Array
  combined: Uint8Array
  cipherText: Uint8Array
  cipherTextAndAuthTag: Uint8Array
}

export const transformToSealbox = (
  bytes: Uint8Array,
  options?: { nonceLength?: number; authTagLength?: number },
): SealedBoxProps => {
  const { nonceLength = 12, authTagLength = 16 } = options ?? {}
  const iv = bytes.slice(0, nonceLength)
  const cipherText = bytes.slice(nonceLength, bytes.length - authTagLength)
  const authTag = bytes.slice(bytes.length - authTagLength)

  return {
    iv,
    cipherText,
    authTag,
    combined: bytes,
    cipherTextAndAuthTag: concatBytes(cipherText, authTag),
  }
}
