import { Message } from '@radixdlt/radix-engine-toolkit'

export const createStringMessage = (value: string): Message => ({
  kind: 'PlainText',
  value: {
    message: { kind: 'String', value },
    mimeType: 'text/plain',
  },
})
