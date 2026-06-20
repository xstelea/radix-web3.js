import { assert, describe, it } from '@effect/vitest';
import { Effect } from 'effect';

import {
  InvalidPaymentPayloadError,
  parseX402PaymentHeader,
} from './paymentPayload';

describe('x402 payment payload', () => {
  it.effect(
    'extracts the signed partial transaction from PaymentPayload.payload.transaction',
    () =>
      Effect.gen(function* () {
        const result = yield* parseX402PaymentHeader(
          JSON.stringify({
            x402Version: 2,
            payload: {
              transaction: '4d220504',
            },
          }),
        );

        assert.deepStrictEqual(result, {
          transaction: '4d220504',
        });
      }),
  );

  it.effect('fails malformed payloads with a typed error', () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(parseX402PaymentHeader('{'));

      assert.instanceOf(error, InvalidPaymentPayloadError);
    }),
  );
});
