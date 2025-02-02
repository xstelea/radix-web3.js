import { concatBytes } from '@noble/hashes/utils'

const deriveCryptoKey = (input: Uint8Array) =>
  crypto.subtle.importKey(
    'raw',
    input,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt'],
  )

export const decrypt = ({
  data,
  encryptionKey,
  iv,
}: {
  data: Uint8Array
  encryptionKey: Uint8Array
  iv: Uint8Array
}) =>
  deriveCryptoKey(encryptionKey)
    .then((key) => crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data))
    .then((decrypted) => new Uint8Array(decrypted))

export const encrypt = (
  data: Uint8Array,
  encryptionKey: Uint8Array,
  iv = crypto.getRandomValues(new Uint8Array(12)),
) =>
  deriveCryptoKey(encryptionKey)
    .then((cryptoKey) =>
      crypto.subtle
        .encrypt(
          {
            name: 'AES-GCM',
            iv,
          },
          cryptoKey,
          data,
        )
        .then((cipherText) => new Uint8Array(cipherText)),
    )
    .then((cipherText) => ({
      combined: concatBytes(iv, cipherText),
      iv,
      cipherText,
    }))
