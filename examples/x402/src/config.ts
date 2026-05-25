import { Data, Effect } from 'effect';

export type X402Config = {
  networkId: 1;
  gatewayBaseUrl: string;
  resourceBaseUrl: string;
  feePayerAccount: string;
  payTo: string;
  facilitatorNotaryBadge: string;
  asset: string;
  amount: string;
  maxTimeoutSeconds: number;
  intentDiscriminator: string;
};

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

export const validateX402Config = (
  config: X402Config,
): Effect.Effect<X402Config, ConfigPlaceholderError> => {
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

  return placeholderPaths.length === 0
    ? Effect.succeed(config)
    : Effect.fail(new ConfigPlaceholderError({ placeholderPaths }));
};

export const paymentRequirementsFromConfig = (input: {
  config: X402Config;
  resourceUrl: string;
}) => ({
  scheme: 'exact' as const,
  network: 'radix:mainnet' as const,
  resourceUrl: input.resourceUrl,
  payTo: input.config.payTo,
  asset: input.config.asset,
  amount: input.config.amount,
  maxTimeoutSeconds: input.config.maxTimeoutSeconds,
  extra: {
    mode: 'sponsored' as const,
    notaryBadge: input.config.facilitatorNotaryBadge,
    intentDiscriminator: input.config.intentDiscriminator,
  },
});
