export type ParsedPaymentPayload = {
  transaction: string;
};

export const parseX402PaymentHeader = (
  headerValue: string,
): ParsedPaymentPayload => {
  const parsed = JSON.parse(headerValue) as unknown;

  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'payload' in parsed &&
    typeof parsed.payload === 'object' &&
    parsed.payload !== null &&
    'transaction' in parsed.payload &&
    typeof parsed.payload.transaction === 'string'
  ) {
    return { transaction: parsed.payload.transaction };
  }

  throw new Error('Invalid x402 payment payload');
};
