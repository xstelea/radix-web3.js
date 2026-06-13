import { assert, describe, it } from '@effect/vitest';
import { Effect } from 'effect';

import {
  ConfigParseError,
  ConfigPlaceholderError,
  mainnetConfigTemplate,
  parseX402Config,
  validateX402Config,
} from './config';

describe('Placeholder Rejection', () => {
  it.effect('rejects the Mainnet config template before runtime use', () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        validateX402Config(mainnetConfigTemplate),
      );

      assert.instanceOf(error, ConfigPlaceholderError);
      assert.deepStrictEqual(error.placeholderPaths, [
        'gatewayBaseUrl',
        'resourceBaseUrl',
        'feePayerAccount',
        'payTo',
        'facilitatorNotaryBadge',
        'asset',
        'intentDiscriminator',
      ]);
    }),
  );

  it.effect('rejects malformed config JSON with a typed parse error', () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(parseX402Config('{'));

      assert.instanceOf(error, ConfigParseError);
    }),
  );
});
