import { describe, expect, it } from 'vitest';
import { parseX402PaymentHeader } from './paymentPayload';

describe('x402 payment payload', () => {
  it('extracts the signed partial transaction from PaymentPayload.payload.transaction', () => {
    expect(
      parseX402PaymentHeader(
        JSON.stringify({
          x402Version: 2,
          payload: {
            transaction: '4d220504',
          },
        }),
      ),
    ).toEqual({
      transaction: '4d220504',
    });
  });
});
