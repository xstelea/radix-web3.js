import blake from 'blakejs';

export const blake2b = (input: Uint8Array) =>
  blake.blake2bHex(input, undefined, 32);
