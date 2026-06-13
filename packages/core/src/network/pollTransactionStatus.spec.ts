import { afterEach, assert, describe, expect, it, vi } from 'vitest';

import {
  type TransactionStatusGateway,
  pollTransactionStatusFactory,
} from './pollTransactionStatus';

type TestTransactionStatus = {
  intent_status: 'Pending' | 'CommittedSuccess';
};

const response = (
  intentStatus: TestTransactionStatus['intent_status'],
): TestTransactionStatus => ({
  intent_status: intentStatus,
});

describe('pollTransactionStatusFactory', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls until the transaction is no longer pending', async () => {
    vi.useFakeTimers();
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce(response('Pending'))
      .mockResolvedValueOnce(response('CommittedSuccess'));
    const gatewayApiClient: TransactionStatusGateway<TestTransactionStatus> = {
      transaction: { getStatus },
    };

    const polling = pollTransactionStatusFactory(gatewayApiClient)(
      'txid_rdx1success',
      {
        delayFn: () => 10,
      },
    );

    await vi.runAllTimersAsync();

    assert.strictEqual((await polling).intent_status, 'CommittedSuccess');
    assert.strictEqual(getStatus.mock.calls.length, 2);
    assert.strictEqual(getStatus.mock.calls[0]?.[0], 'txid_rdx1success');
  });

  it('rejects when the transaction remains pending past the retry budget', async () => {
    vi.useFakeTimers();
    const getStatus = vi.fn().mockResolvedValue(response('Pending'));
    const gatewayApiClient: TransactionStatusGateway<TestTransactionStatus> = {
      transaction: { getStatus },
    };

    const polling = pollTransactionStatusFactory(gatewayApiClient)(
      'txid_rdx1pending',
      {
        delayFn: () => 10,
        maxRetries: 2,
      },
    );
    const expected = expect(polling).rejects.toThrow(
      'Transaction polling timed out',
    );

    await vi.runAllTimersAsync();

    await expected;
    assert.strictEqual(getStatus.mock.calls.length, 2);
  });
});
