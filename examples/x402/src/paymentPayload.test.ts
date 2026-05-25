import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  InvalidPaymentPayloadError,
  parseX402PaymentHeader,
} from './paymentPayload';

describe('x402 payment payload', () => {
  it('extracts the signed partial transaction from PaymentPayload.payload.transaction', async () => {
    await expect(
      Effect.runPromise(
        parseX402PaymentHeader(
          JSON.stringify({
            x402Version: 2,
            payload: {
              transaction: '4d220504',
            },
          }),
        ),
      ),
    ).resolves.toEqual({
      transaction: '4d220504',
    });
  });

  it('fails malformed payloads with a typed error', async () => {
    await expect(
      Effect.runPromise(Effect.flip(parseX402PaymentHeader('{'))),
    ).resolves.toBeInstanceOf(InvalidPaymentPayloadError);
  });
});
