import crypto from 'node:crypto';

export const randomBytes = (byteCount: number): Uint8Array => {
  if (typeof window !== 'undefined' && window.crypto) {
    // Browser environment
    return window.crypto.getRandomValues(new Uint8Array(byteCount));
  }
  // Node.js environment
  return new Uint8Array(crypto.randomBytes(byteCount));
};
