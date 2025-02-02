import { concatBytes } from '@noble/hashes/utils'
import { blake2b } from '../../../crypto/blake2b'

export const createMessageHash = ({
  interactionId,
  dAppDefinitionAddress,
  origin,
}: {
  interactionId: string
  dAppDefinitionAddress: string
  origin: string
}) => {
  const encoder = new TextEncoder()

  return blake2b(
    concatBytes(
      encoder.encode('C'),
      encoder.encode(interactionId),
      new Uint8Array([dAppDefinitionAddress.length]),
      encoder.encode(dAppDefinitionAddress),
      encoder.encode(origin),
    ),
  )
}
