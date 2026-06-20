import { Effect, Schema } from 'effect';

export const TransactionDetailsOptInsSchema = Schema.Struct({
  /** if set to `true`, raw transaction hex is returned. */
  raw_hex: Schema.Boolean.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(false)),
  ),
  /** if set to `true`, state changes inside receipt object are returned. */
  receipt_state_changes: Schema.Boolean.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(false)),
  ),
  /** if set to `true`, fee summary inside receipt object is returned. */
  receipt_fee_summary: Schema.Boolean.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(false)),
  ),
  /** if set to `true`, fee source inside receipt object is returned. */
  receipt_fee_source: Schema.Boolean.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(false)),
  ),
  /** if set to `true`, fee destination inside receipt object is returned. */
  receipt_fee_destination: Schema.Boolean.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(false)),
  ),
  /** if set to `true`, costing parameters inside receipt object is returned. */
  receipt_costing_parameters: Schema.Boolean.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(false)),
  ),
  /**
   * if set to `true`, events inside receipt object is returned.
   * @deprecated Please use `detailed_events` instead.
   */
  receipt_events: Schema.Boolean.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(false)),
  ),
  /** if set to `true`, detailed events object is returned. */
  detailed_events: Schema.Boolean.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(false)),
  ),
  /** (true by default) if set to `true`, transaction receipt output is returned. */
  receipt_output: Schema.Boolean.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(true)),
  ),
  /** if set to `true`, all affected global entities by given transaction are returned. */
  affected_global_entities: Schema.Boolean.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(false)),
  ),
  /** if set to `true`, manifest instructions for user transactions are returned. */
  manifest_instructions: Schema.Boolean.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(false)),
  ),
  /**
   * if set to `true`, returns the fungible and non-fungible balance changes.
   * Warning: This opt-in might be missing for recently committed transactions.
   */
  balance_changes: Schema.Boolean.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(false)),
  ),
});

export type TransactionDetailsOptIns =
  typeof TransactionDetailsOptInsSchema.Type;

export const makeTransactionDetailsOptIns = (
  input: Partial<TransactionDetailsOptIns> = {},
) => Schema.decodeUnknownSync(TransactionDetailsOptInsSchema)(input);

export const ConfigSchema = Schema.Struct({
  stateVersion: Schema.Option(Schema.Number),
  limitPerPage: Schema.Number,
  waitTime: Schema.Duration,
  optIns: TransactionDetailsOptInsSchema,
});

export type Config = typeof ConfigSchema.Type;
