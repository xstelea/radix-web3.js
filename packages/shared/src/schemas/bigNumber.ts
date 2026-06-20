import { BigNumber } from 'bignumber.js';
import {
  Effect,
  Option,
  Schema,
  SchemaIssue,
  SchemaTransformation,
} from 'effect';

// Schema that transforms string to BigNumber
export const BigNumberSchema = Schema.Union([
  Schema.String,
  Schema.Number,
]).pipe(
  Schema.decodeTo(
    Schema.instanceOf(BigNumber),
    SchemaTransformation.transformOrFail({
      decode: (input) =>
        Effect.sync(() => new BigNumber(input)).pipe(
          Effect.flatMap((numeric) =>
            numeric.isFinite()
              ? Effect.succeed(numeric)
              : Effect.fail(
                  new SchemaIssue.InvalidValue(Option.some(input), {
                    message: 'BigNumber value must be finite',
                  }),
                ),
          ),
        ),
      encode: (bn) => Effect.succeed(bn.toString()),
    }),
  ),
);
