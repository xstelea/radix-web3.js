import { Effect } from 'effect';
import type { MiddlewareHandler } from 'hono';

import { parseX402PaymentHeader } from './paymentPayload';
import {
  type PaymentRequirements,
  paymentRequirementsHash,
} from './paymentRequirements';
import { settlementCacheKey } from './settlementCache';

type SettlementResult =
  | { status: 'CommittedSuccess'; subintentHash?: string }
  | { status: string; subintentHash?: string };

export type X402PaymentMiddlewareOptions = {
  requirements: PaymentRequirements;
  settlePayment?: (input: {
    signedPartialTransactionHex: string;
    requirements: PaymentRequirements;
    resourceUrl: string;
  }) => Effect.Effect<SettlementResult, unknown>;
};

export const createX402PaymentMiddleware = ({
  requirements,
  settlePayment,
}: X402PaymentMiddlewareOptions): MiddlewareHandler => {
  const settlementRecords = new Set<string>();
  const payloadSettlementKeys = new Map<string, string>();

  return (context, next) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const paymentPayload = context.req.header('X-PAYMENT');

        if (paymentPayload === undefined) {
          return context.json(
            {
              x402Version: 2,
              accepts: [
                {
                  ...requirements,
                  paymentRequirementsHash:
                    paymentRequirementsHash(requirements),
                },
              ],
            },
            402,
          );
        }

        const parsedPaymentPayload =
          yield* parseX402PaymentHeader(paymentPayload);
        const existingSettlementKey = payloadSettlementKeys.get(
          parsedPaymentPayload.transaction,
        );

        if (
          existingSettlementKey !== undefined &&
          settlementRecords.has(existingSettlementKey)
        ) {
          yield* Effect.tryPromise(() => next());
          return;
        }

        const pendingCacheKey = (subintentHash: string) =>
          settlementCacheKey({
            subintentHash,
            requirements,
            resourceUrl: requirements.resourceUrl,
          });
        const settlementEffect: Effect.Effect<SettlementResult> =
          settlePayment === undefined
            ? Effect.succeed({
                status: 'MissingSettlementHandler',
              } satisfies SettlementResult)
            : settlePayment({
                signedPartialTransactionHex: parsedPaymentPayload.transaction,
                requirements,
                resourceUrl: requirements.resourceUrl,
              }).pipe(
                Effect.catch(() =>
                  Effect.succeed({
                    status: 'SettlementFailed',
                  } satisfies SettlementResult),
                ),
              );
        const settlement = yield* settlementEffect;

        if (settlement.status !== 'CommittedSuccess') {
          return context.json(
            {
              error: 'payment_not_settled',
              paymentStatus: settlement.status,
            },
            402,
          );
        }

        if (
          'subintentHash' in settlement &&
          settlement.subintentHash !== undefined
        ) {
          const cacheKey = pendingCacheKey(settlement.subintentHash);
          settlementRecords.add(cacheKey);
          payloadSettlementKeys.set(parsedPaymentPayload.transaction, cacheKey);
        }

        yield* Effect.tryPromise(() => next());
      }).pipe(
        Effect.catchTag('InvalidPaymentPayloadError', () =>
          Effect.succeed(
            context.json(
              {
                error: 'invalid_payment_payload',
              },
              402,
            ),
          ),
        ),
      ),
    );
};
