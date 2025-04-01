import { rolaTestVectors } from './testVectors'
import { createRolaMessage } from './createRolaMessage'
import { describe, expect, test } from 'vitest'

const testVectors = rolaTestVectors

describe('createRolaMessage', () => {
  test('should create ROLA message', () => {
    for (const testVector of testVectors) {
      const { blakeHashOfPayload, dAppDefinitionAddress, origin, challenge } =
        testVector
      const result = createRolaMessage({
        dAppDefinitionAddress,
        origin,
        challenge,
      })
      expect(result).toEqual(blakeHashOfPayload)
    }
  })
})
