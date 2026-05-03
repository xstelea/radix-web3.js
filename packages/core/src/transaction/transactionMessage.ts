import type { Message } from '@steleaio/radix-engine-toolkit';

export const createStringMessage = (value: string): Message => ({
  kind: 'PlainText',
  value: {
    message: { kind: 'String', value },
    mimeType: 'text/plain',
  },
});
