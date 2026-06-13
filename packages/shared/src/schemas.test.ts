import { assert, describe, it } from '@effect/vitest';
import { BigNumber } from 'bignumber.js';
import { Effect, Result, Schema } from 'effect';

import {
  AccountSchema,
  BigNumberSchema,
  SecurifiedAccountSchema,
  UnsecurifiedAccountSchema,
} from './index';

const decode = Schema.decodeUnknownEffect;

describe('@radix-effects/shared schemas', () => {
  it.effect(
    'decodes and encodes account variants with canonical type fields',
    () =>
      Effect.gen(function* () {
        const unsecurified = yield* decode(UnsecurifiedAccountSchema)({
          address: 'account_rdx1payer',
        });
        const securified = yield* decode(SecurifiedAccountSchema)({
          address: 'account_rdx1owner',
          accessControllerAddress: 'accesscontroller_rdx1owner',
        });

        assert.deepEqual(unsecurified, {
          type: 'unsecurifiedAccount',
          address: 'account_rdx1payer',
        });
        assert.deepEqual(securified, {
          type: 'securifiedAccount',
          address: 'account_rdx1owner',
          accessControllerAddress: 'accesscontroller_rdx1owner',
        });
        assert.deepEqual(
          yield* Schema.encodeEffect(UnsecurifiedAccountSchema)(unsecurified),
          {
            type: 'unsecurifiedAccount',
            address: 'account_rdx1payer',
          },
        );
        assert.deepEqual(
          yield* Schema.encodeEffect(SecurifiedAccountSchema)(securified),
          {
            type: 'securifiedAccount',
            address: 'account_rdx1owner',
            accessControllerAddress: 'accesscontroller_rdx1owner',
          },
        );
      }),
  );

  it.effect('selects account variants by required fields', () =>
    Effect.gen(function* () {
      const account = yield* decode(AccountSchema)({
        address: 'account_rdx1owner',
        accessControllerAddress: 'accesscontroller_rdx1owner',
      });

      assert.strictEqual(account.type, 'securifiedAccount');
    }),
  );

  it.effect('decodes finite decimal strings and numbers to BigNumber', () =>
    Effect.gen(function* () {
      const fromString = yield* decode(BigNumberSchema)('1.500');
      const fromNumber = yield* decode(BigNumberSchema)(2);

      assert.instanceOf(fromString, BigNumber);
      assert.strictEqual(fromString.toString(), '1.5');
      assert.strictEqual(fromNumber.toString(), '2');
      assert.strictEqual(
        yield* Schema.encodeEffect(BigNumberSchema)(fromString),
        '1.5',
      );
    }),
  );

  it.effect('rejects non-finite BigNumber input', () =>
    Effect.gen(function* () {
      const decoded = yield* Effect.result(
        decode(BigNumberSchema)('not-a-number'),
      );

      assert.isTrue(Result.isFailure(decoded));
    }),
  );
});
