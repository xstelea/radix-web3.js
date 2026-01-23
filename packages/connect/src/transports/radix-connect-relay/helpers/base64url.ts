import base64url from 'base64url';

export const base64urlEncode = (value: Record<string, unknown>): string =>
  base64url.encode(JSON.stringify(value), 'utf-8');
