import { createHash } from 'node:crypto';

export type PaymentRequirements = {
  scheme: 'exact';
  network: 'radix:mainnet';
  resourceUrl: string;
  payTo: string;
  asset: string;
  amount: string;
  maxTimeoutSeconds: number;
  extra: {
    mode: 'sponsored';
    notaryBadge: string;
    intentDiscriminator: string;
  };
  advisoryPaymentManifestTemplate?: string;
  advisoryPreviewRootManifestTemplate?: string;
};

export const paymentRequirementsHash = (
  requirements: PaymentRequirements,
): string => {
  const canonicalSemanticFields = [
    ['scheme', requirements.scheme],
    ['network', requirements.network],
    ['resourceUrl', requirements.resourceUrl],
    ['payTo', requirements.payTo],
    ['asset', requirements.asset],
    ['amount', requirements.amount],
    ['maxTimeoutSeconds', requirements.maxTimeoutSeconds],
    ['extra.mode', requirements.extra.mode],
    ['extra.notaryBadge', requirements.extra.notaryBadge],
    ['extra.intentDiscriminator', requirements.extra.intentDiscriminator],
  ];

  return createHash('sha256')
    .update(JSON.stringify(canonicalSemanticFields))
    .digest('hex');
};
