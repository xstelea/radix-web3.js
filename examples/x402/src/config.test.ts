import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  ConfigParseError,
  ConfigPlaceholderError,
  mainnetConfigTemplate,
  parseX402Config,
  validateX402Config,
} from './config';

describe('Placeholder Rejection', () => {
  it('rejects the Mainnet config template before runtime use', async () => {
    const error = await Effect.runPromise(
      Effect.flip(validateX402Config(mainnetConfigTemplate)),
    );

    expect(error).toBeInstanceOf(ConfigPlaceholderError);
    expect(error.placeholderPaths).toEqual([
      'gatewayBaseUrl',
      'resourceBaseUrl',
      'feePayerAccount',
      'payTo',
      'facilitatorNotaryBadge',
      'asset',
      'intentDiscriminator',
    ]);
  });

  it('rejects malformed config JSON with a typed parse error', async () => {
    const error = await Effect.runPromise(Effect.flip(parseX402Config('{')));

    expect(error).toBeInstanceOf(ConfigParseError);
  });
});
