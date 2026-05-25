import { createHash } from 'node:crypto';
import {
  type PaymentRequirements,
  paymentRequirementsHash,
} from './paymentRequirements';

export type SettlementCacheKeyInput = {
  subintentHash: string;
  requirements: PaymentRequirements;
  resourceUrl: string;
};

export const settlementCacheKey = ({
  subintentHash,
  requirements,
  resourceUrl,
}: SettlementCacheKeyInput): string =>
  createHash('sha256')
    .update(
      JSON.stringify([
        ['subintentHash', subintentHash],
        ['paymentRequirementsHash', paymentRequirementsHash(requirements)],
        ['resourceUrl', resourceUrl],
      ]),
    )
    .digest('hex');
