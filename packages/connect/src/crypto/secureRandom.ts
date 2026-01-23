import crypto from 'node:crypto';

export const secureRandom = (byteCount: number) =>
  crypto.getRandomValues(new Uint8Array(byteCount));
