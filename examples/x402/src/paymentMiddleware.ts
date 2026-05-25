import type { MiddlewareHandler } from 'hono';
import { parseX402PaymentHeader } from './paymentPayload';
import {
  type PaymentRequirements,
  paymentRequirementsHash,
} from './paymentRequirements';
import { settlementCacheKey } from './settlementCache';

type SettlementResult =
  | { status: 'CommittedSuccess'; subintentHash: string }
  | { status: string; subintentHash?: string };

export type X402PaymentMiddlewareOptions = {
  requirements: PaymentRequirements;
  settlePayment?: (input: {
    signedPartialTransactionHex: string;
    requirements: PaymentRequirements;
    resourceUrl: string;
  }) => Promise<SettlementResult>;
};

export const createX402PaymentMiddleware = ({
  requirements,
  settlePayment,
}: X402PaymentMiddlewareOptions): MiddlewareHandler => {
  const settlementRecords = new Set<string>();
  const payloadSettlementKeys = new Map<string, string>();

  return async (context, next) => {
    const paymentPayload = context.req.header('X-PAYMENT');

    if (paymentPayload === undefined) {
      return context.json(
        {
          x402Version: 2,
          accepts: [
            {
              ...requirements,
              paymentRequirementsHash: paymentRequirementsHash(requirements),
            },
          ],
        },
        402,
      );
    }

    const parsedPaymentPayload = parseX402PaymentHeader(paymentPayload);
    const existingSettlementKey = payloadSettlementKeys.get(
      parsedPaymentPayload.transaction,
    );
    if (
      existingSettlementKey !== undefined &&
      settlementRecords.has(existingSettlementKey)
    ) {
      await next();
      return;
    }

    const pendingCacheKey = (subintentHash: string) =>
      settlementCacheKey({
        subintentHash,
        requirements,
        resourceUrl: requirements.resourceUrl,
      });
    const settlement = await settlePayment?.({
      signedPartialTransactionHex: parsedPaymentPayload.transaction,
      requirements,
      resourceUrl: requirements.resourceUrl,
    });

    if (settlement?.status !== 'CommittedSuccess') {
      return context.json(
        {
          error: 'payment_not_settled',
          paymentStatus: settlement?.status ?? 'MissingSettlementHandler',
        },
        402,
      );
    }

    if (settlement.subintentHash !== undefined) {
      const cacheKey = pendingCacheKey(settlement.subintentHash);
      settlementRecords.add(cacheKey);
      payloadSettlementKeys.set(parsedPaymentPayload.transaction, cacheKey);
    }

    await next();
  };
};
