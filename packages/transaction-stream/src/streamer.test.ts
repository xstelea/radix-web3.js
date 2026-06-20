import { assert, describe, it } from '@effect/vitest';
import { GatewayApiClient } from '@radix-effects/gateway';
import { Duration, Effect, Layer, Option, Ref, Stream } from 'effect';

import { ConfigService } from './config';
import { makeTransactionDetailsOptIns } from './schemas';
import { TransactionStreamService } from './streamer';

type GatewayClient = Effect.Success<typeof GatewayApiClient.make>;
type StreamTransactions =
  GatewayClient['stream']['innerClient']['streamTransactions'];
type StreamTransactionsOperationRequest = Parameters<StreamTransactions>[0];
type StreamTransactionsResponse = Effect.Success<
  ReturnType<StreamTransactions>
>;

describe('TransactionStreamService', () => {
  it.effect(
    'streams committed transaction pages and advances state version',
    () =>
      Effect.gen(function* () {
        const requests = yield* Ref.make<
          Array<StreamTransactionsOperationRequest>
        >([]);
        const configRef = yield* ConfigService.make;
        yield* Ref.update(configRef, (config) => ({
          ...config,
          stateVersion: Option.some(10),
          limitPerPage: 2,
          waitTime: Duration.millis(1),
          optIns: makeTransactionDetailsOptIns({
            detailed_events: true,
          }),
        }));

        const fakeGatewayLayer = Layer.effect(
          GatewayApiClient,
          GatewayApiClient.make.pipe(
            Effect.map((client) => ({
              ...client,
              status: {
                ...client.status,
                getCurrent: () =>
                  Effect.succeed({
                    ledger_state: {
                      network: 'mainnet',
                      state_version: 9,
                      proposer_round_timestamp: '2026-01-01T00:00:00.000Z',
                      epoch: 1,
                      round: 1,
                    },
                    release_info: {
                      release_version: 'test',
                      open_api_schema_version: 'test',
                      image_tag: 'test',
                    },
                  }),
              },
              stream: {
                innerClient: {
                  ...client.stream.innerClient,
                  streamTransactions: (
                    request: StreamTransactionsOperationRequest,
                  ) =>
                    Ref.update(requests, (items) => [...items, request]).pipe(
                      Effect.as({
                        ledger_state: {
                          network: 'mainnet',
                          state_version: 11,
                          proposer_round_timestamp: '2026-01-01T00:00:02.000Z',
                          epoch: 1,
                          round: 2,
                        },
                        items: [
                          {
                            state_version: 10,
                            epoch: 1,
                            round: 1,
                            round_timestamp: '2026-01-01T00:00:01.000Z',
                            transaction_status: 'CommittedSuccess',
                            intent_hash: 'txid_rdx1first',
                          },
                          {
                            state_version: 11,
                            epoch: 1,
                            round: 2,
                            round_timestamp: '2026-01-01T00:00:02.000Z',
                            transaction_status: 'CommittedSuccess',
                            intent_hash: 'txid_rdx1second',
                          },
                        ],
                      } satisfies StreamTransactionsResponse),
                    ),
                },
              },
            })),
          ),
        );

        const stream = yield* TransactionStreamService.pipe(
          Effect.provide(TransactionStreamService.DefaultWithoutDependencies),
          Effect.provide(fakeGatewayLayer),
        );

        const pages = yield* stream.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.provide(Layer.succeed(ConfigService, configRef)),
        );

        assert.deepEqual(
          Array.from(pages).map((page) =>
            page.map((transaction) => transaction.intent_hash),
          ),
          [['txid_rdx1first', 'txid_rdx1second']],
        );

        const updatedConfig = yield* Ref.get(configRef);
        assert.deepEqual(updatedConfig.stateVersion, Option.some(12));

        const capturedRequests = yield* Ref.get(requests);
        assert.deepEqual(capturedRequests, [
          {
            streamTransactionsRequest: {
              limit_per_page: 2,
              from_ledger_state: {
                state_version: 10,
              },
              order: 'Asc',
              kind_filter: 'User',
              opt_ins: makeTransactionDetailsOptIns({
                detailed_events: true,
              }),
            },
          },
        ]);
      }),
  );
});
