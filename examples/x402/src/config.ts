import { Data, Effect, Schema } from 'effect';
import type { PaymentRequirements } from './paymentRequirements';

export const X402ConfigSchema = Schema.Struct({
  networkId: Schema.Literal(1),
  gatewayBaseUrl: Schema.String,
  resourceBaseUrl: Schema.String,
  feePayerAccount: Schema.String,
  payTo: Schema.String,
  facilitatorNotaryBadge: Schema.String,
  asset: Schema.String,
  amount: Schema.String,
  maxTimeoutSeconds: Schema.Number,
  intentDiscriminator: Schema.String,
});

export type X402Config = typeof X402ConfigSchema.Type;

export class ConfigParseError extends Data.TaggedError('ConfigParseError')<{
  reason: unknown;
}> {}

export class ConfigPlaceholderError extends Data.TaggedError(
  'ConfigPlaceholderError',
)<{
  placeholderPaths: ReadonlyArray<string>;
}> {}

export const mainnetConfigTemplate: X402Config = {
  networkId: 1,
  gatewayBaseUrl: '<MAINNET_GATEWAY_BASE_URL>',
  resourceBaseUrl: '<RESOURCE_BASE_URL>',
  feePayerAccount: '<FEE_PAYER_ACCOUNT>',
  payTo: '<PAY_TO_ACCOUNT>',
  facilitatorNotaryBadge: '<FACILITATOR_NOTARY_BADGE>',
  asset: '<PAYMENT_ASSET>',
  amount: '1',
  maxTimeoutSeconds: 60,
  intentDiscriminator: '<INTENT_DISCRIMINATOR>',
};

const isPlaceholder = (value: string): boolean =>
  value.startsWith('<') && value.endsWith('>');

export const validateX402Config = Effect.fn('validateX402Config')(function* (
  config: X402Config,
) {
  const placeholderPaths = [
    isPlaceholder(config.gatewayBaseUrl) ? 'gatewayBaseUrl' : undefined,
    isPlaceholder(config.resourceBaseUrl) ? 'resourceBaseUrl' : undefined,
    isPlaceholder(config.feePayerAccount) ? 'feePayerAccount' : undefined,
    isPlaceholder(config.payTo) ? 'payTo' : undefined,
    isPlaceholder(config.facilitatorNotaryBadge)
      ? 'facilitatorNotaryBadge'
      : undefined,
    isPlaceholder(config.asset) ? 'asset' : undefined,
    isPlaceholder(config.amount) ? 'amount' : undefined,
    isPlaceholder(config.intentDiscriminator)
      ? 'intentDiscriminator'
      : undefined,
  ].filter((path) => path !== undefined);

  if (placeholderPaths.length > 0) {
    return yield* Effect.fail(new ConfigPlaceholderError({ placeholderPaths }));
  }

  return config;
});

export const parseX402Config = Effect.fn('parseX402Config')(function* (
  rawConfig: string,
) {
  const config = yield* Schema.decodeUnknown(
    Schema.parseJson(X402ConfigSchema),
  )(rawConfig).pipe(
    Effect.mapError((reason) => new ConfigParseError({ reason })),
  );

  return yield* validateX402Config(config);
});

export const paymentRequirementsFromConfig = (input: {
  config: X402Config;
  resourceUrl: string;
}): PaymentRequirements => ({
  scheme: 'exact',
  network: 'radix:mainnet',
  resourceUrl: input.resourceUrl,
  payTo: input.config.payTo,
  asset: input.config.asset,
  amount: input.config.amount,
  maxTimeoutSeconds: input.config.maxTimeoutSeconds,
  extra: {
    mode: 'sponsored',
    notaryBadge: input.config.facilitatorNotaryBadge,
    intentDiscriminator: input.config.intentDiscriminator,
  },
});
