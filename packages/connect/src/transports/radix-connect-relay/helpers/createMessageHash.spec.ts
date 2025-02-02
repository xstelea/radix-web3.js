import { createMessageHash } from './createMessageHash'
import { describe, it, expect } from 'vitest'

describe('createMessage', () => {
  it('should create a valid message with provided data', () => {
    const hash = createMessageHash({
      interactionId: '15adc691-a061-4204-b2e4-96607c8063d2',
      dAppDefinitionAddress:
        'account_rdx12x0xfz2yumu2qsh6yt0v8xjfc7et04vpsz775kc3yd3xvle4w5d5k5',
      origin: 'https://dashboard.radixdlt.com',
    })

    expect(hash).toEqual(
      '9cc162941a5fbe5bc15d9d1892381ffe734bee27fb272f9d00b64d16007166d9',
    )
  })
})
