import { Data, Effect, Schema } from 'effect';

const X402PaymentHeaderSchema = Schema.Struct({
  payload: Schema.Struct({
    transaction: Schema.String,
  }),
});

export type ParsedPaymentPayload = {
  transaction: string;
};

export class InvalidPaymentPayloadError extends Data.TaggedError(
  'InvalidPaymentPayloadError',
)<{
  reason: unknown;
}> {}

export const parseX402PaymentHeader = Effect.fn('parseX402PaymentHeader')(
  (
    headerValue: string,
  ): Effect.Effect<ParsedPaymentPayload, InvalidPaymentPayloadError> =>
    Schema.decodeUnknown(Schema.parseJson(X402PaymentHeaderSchema))(
      headerValue,
    ).pipe(
      Effect.mapError((reason) => new InvalidPaymentPayloadError({ reason })),
      Effect.map(({ payload }) => ({ transaction: payload.transaction })),
    ),
);
