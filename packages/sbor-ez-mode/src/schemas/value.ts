import type { ProgrammaticScryptoSborValue } from '@radixdlt/babylon-gateway-api-sdk';
import { Effect } from 'effect';
import { SborSchema, kinds } from '../sborSchema';

// Primitive schemas
export class ValueSchema extends SborSchema<ProgrammaticScryptoSborValue> {
  constructor() {
    super(kinds);
  }

  validate() {
    return Effect.void;
  }

  parse(value: unknown) {
    return Effect.succeed(value as ProgrammaticScryptoSborValue);
  }
}
