import { BigNumber } from 'bignumber.js';
import { Effect, Option, Schema, SchemaGetter, SchemaIssue } from 'effect';

// Schema that transforms string to BigNumber
export const BigNumberSchema = Schema.Union([
  Schema.String,
  Schema.Number,
]).pipe(
  Schema.decodeTo(Schema.instanceOf(BigNumber), {
    decode: SchemaGetter.transformOrFail((input) =>
      Effect.try({
        try: () => new BigNumber(input),
        catch: (_) =>
          new SchemaIssue.InvalidValue(Option.some(input), {
            message: 'Failed to parse BigNumber',
          }),
      }),
    ),
    encode: SchemaGetter.transform((bn) => bn.toString()),
  }),
);
