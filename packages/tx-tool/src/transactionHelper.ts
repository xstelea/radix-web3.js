import {
  GatewayApiClient,
  GetFungibleBalance,
  GetLedgerStateService,
} from '@radix-effects/gateway';
import {
  type Account,
  Amount,
  FungibleResourceAddress,
  NetworkId,
  type TransactionId,
  TransactionManifestString,
} from '@radix-effects/shared';
import { RadixEngineToolkit } from '@steleaio/radix-engine-toolkit';
import {
  Array as A,
  Cause,
  Context,
  Data,
  Effect,
  Layer,
  Option,
  Record as R,
  Result,
  flow,
  pipe,
} from 'effect';

import { CompileTransaction } from './compileTransaction';
import { CreateTransactionIntent } from './createTransactionIntent';
import { CreateTransactionIntentV2 } from './createTransactionIntentV2';
import { EpochService } from './epoch';
import { IntentHashService } from './intentHash';
import { createBadge as createBadgeManifest } from './manifests/createBadge';
import { createFungibleTokenManifest } from './manifests/createFungibleToken';
import { faucet as faucetManifest } from './manifests/faucet';
import { ManifestHelper } from './manifests/manifestHelper';
import type { TransactionIntent, TransactionIntentV2 } from './schemas';
import { Signer } from './signer/signer';
import { SubmitTransaction } from './submitTransaction';
import { TransactionStatus } from './transactionStatus';

export class FaucetNotAvailableError extends Data.TaggedError(
  'FaucetNotAvailableError',
)<{
  message: string;
}> {}

export class TransactionLifeCycleHook extends Context.Service<
  TransactionLifeCycleHook,
  {
    onSubmit?: (input: {
      id: TransactionId;
      intent: TransactionIntent | TransactionIntentV2;
    }) => Effect.Effect<void, never, never>;
    onSubmitSuccess?: (input: {
      id: TransactionId;
      intent: TransactionIntent | TransactionIntentV2;
    }) => Effect.Effect<void, never, never>;
    onStatusFailure?: (input: {
      id: TransactionId;
      permanent: boolean;
      intent: TransactionIntent | TransactionIntentV2;
    }) => Effect.Effect<void, never, never>;
    onSuccess?: (input: {
      id: TransactionId;
    }) => Effect.Effect<void, never, never>;
  }
>()('@radix-effects/tx-tool/TransactionLifeCycleHook') {}

export class InsufficientXrdBalanceError extends Data.TaggedError(
  'InsufficientXrdBalanceError',
)<{
  message: string;
}> {}

export class TransactionHelper extends Context.Service<TransactionHelper>()(
  '@radix-effects/tx-tool/TransactionHelper',
  {
    make: Effect.gen(function* () {
      const createTransactionIntent = yield* CreateTransactionIntent;
      const createTransactionIntentV2 = yield* CreateTransactionIntentV2;
      const compileTransaction = yield* CompileTransaction;
      const submitTransactionToNetwork = yield* SubmitTransaction;
      const transactionStatus = yield* TransactionStatus;
      const signer = yield* Signer;
      const manifestHelper = yield* ManifestHelper;
      const intentHashService = yield* IntentHashService;
      const epochService = yield* EpochService;
      const gatewayApiClient = yield* GatewayApiClient;
      const getLedgerStateService = yield* GetLedgerStateService;
      const networkId = NetworkId.make(gatewayApiClient.networkId);

      const knownAddresses = yield* Effect.tryPromise(() =>
        RadixEngineToolkit.Utils.knownAddresses(networkId),
      );

      const getFungibleBalance = yield* GetFungibleBalance;

      const lifeCycleHook = yield* Effect.serviceOption(
        TransactionLifeCycleHook,
      );

      const onSubmitLifeCycleHook = lifeCycleHook.pipe(
        Option.flatMap((item) => Option.fromNullishOr(item.onSubmit)),
      );

      const onSubmitSuccessLifeCycleHook = lifeCycleHook.pipe(
        Option.flatMap((item) => Option.fromNullishOr(item.onSubmitSuccess)),
      );

      const onStatusFailureLifeCycleHook = lifeCycleHook.pipe(
        Option.flatMap((item) => Option.fromNullishOr(item.onStatusFailure)),
      );

      const onSuccessLifeCycleHook = lifeCycleHook.pipe(
        Option.flatMap((item) => Option.fromNullishOr(item.onSuccess)),
      );

      const xrdBalance = (account: Account, stateVersion: number) =>
        getFungibleBalance({
          addresses: [account.address],
          at_ledger_state: {
            state_version: stateVersion,
          },
        }).pipe(
          Effect.map(
            flow(
              A.head,
              Option.map((value) => value.items),
              Option.flatMap(
                A.findFirst(
                  (item) =>
                    item.resource_address ===
                    knownAddresses.resourceAddresses.xrd,
                ),
              ),
            ),
          ),
        );

      const submitTransaction = (input: {
        manifest: TransactionManifestString;
        feePayer?: { account: Account; amount: Amount };
        transactionIntent?: TransactionIntent | TransactionIntentV2;
        version?: 'v1' | 'v2';
      }) =>
        Effect.gen(function* () {
          yield* Option.fromNullishOr(input.feePayer).pipe(
            Option.match({
              onNone: () => Effect.void,
              onSome: (feePayer) =>
                getLedgerStateService({
                  at_ledger_state: {
                    timestamp: new Date(),
                  },
                }).pipe(
                  Effect.flatMap((stateVersion) =>
                    xrdBalance(feePayer.account, stateVersion.state_version),
                  ),
                  Effect.filterOrFail(
                    (amount) =>
                      Option.match(amount, {
                        onNone: () => false,
                        onSome: (amount) => amount.amount.gte(feePayer.amount),
                      }),
                    () =>
                      new InsufficientXrdBalanceError({
                        message: `Insufficient XRD balance for account ${feePayer.account.address}`,
                      }),
                  ),
                ),
            }),
          );

          const { intent, id, hash } = yield* Option.fromNullishOr(
            input.transactionIntent,
          ).pipe(
            Option.match({
              onNone: () =>
                Effect.gen(function* () {
                  yield* Effect.log('Creating transaction intent');
                  const feePayerInstructions = input.feePayer
                    ? yield* manifestHelper.addFeePayer(input.feePayer)
                    : '';

                  const manifestWithFeePayer = TransactionManifestString.make(`
                    ${feePayerInstructions}
                    ${input.manifest}
                  `);

                  if (input.version === 'v2') {
                    return yield* createTransactionIntentV2({
                      manifest: manifestWithFeePayer,
                    }).pipe(
                      Effect.flatMap((intent) =>
                        intentHashService.create(intent).pipe(
                          Effect.map(({ id, hash }) => ({
                            id,
                            hash,
                            intent,
                          })),
                        ),
                      ),
                      Effect.catch((error) => Effect.die(error)),
                    );
                  }

                  return yield* createTransactionIntent({
                    manifest: manifestWithFeePayer,
                  }).pipe(
                    Effect.flatMap((intent) =>
                      intentHashService
                        .create(intent)
                        .pipe(
                          Effect.map(({ id, hash }) => ({ id, hash, intent })),
                        ),
                    ),
                    Effect.catch((error) => Effect.die(error)),
                  );
                }),
              onSome: (intent) =>
                intentHashService.create(intent).pipe(
                  Effect.flatMap(({ id, hash }) =>
                    epochService
                      .verifyEpochBounds({
                        transactionId: id,
                        transactionIntent: intent,
                      })
                      .pipe(Effect.as({ id, hash, intent })),
                  ),
                ),
            }),
          );

          return yield* Effect.gen(function* () {
            yield* Effect.log('Collecting signatures');
            const signatures = yield* signer.signToSignatureWithPublicKey(hash);

            const compiledTransaction = yield* compileTransaction({
              intent,
              signatures,
            }).pipe(Effect.catch(Effect.die));

            yield* Option.match(onSubmitLifeCycleHook, {
              onNone: () => Effect.void,
              onSome: (effect) =>
                Effect.gen(function* () {
                  yield* Effect.log('Executing life cycle hook: onSubmit');
                  yield* effect({ id, intent });
                }),
            });

            yield* Effect.log('Submitting transaction to network');
            yield* submitTransactionToNetwork({
              compiledTransaction: compiledTransaction,
            });

            yield* Option.match(onSubmitSuccessLifeCycleHook, {
              onNone: () => Effect.void,
              onSome: (effect) =>
                Effect.gen(function* () {
                  yield* Effect.log(
                    'Executing life cycle hook: onSubmitSuccess',
                  );
                  yield* effect({ id, intent });
                }),
            });

            const result = yield* transactionStatus
              .poll({
                id,
              })
              .pipe(
                Effect.map((status) => ({ statusResponse: status, id })),
                Effect.catchCause((cause) =>
                  Effect.gen(function* () {
                    yield* Option.match(onStatusFailureLifeCycleHook, {
                      onNone: () => Effect.void,
                      onSome: (effect) =>
                        Effect.gen(function* () {
                          yield* Effect.log(
                            'Executing life cycle hook: onFailure',
                          );

                          const permanent = pipe(
                            Cause.findError(cause),
                            Result.match({
                              onFailure: () => false,
                              onSuccess: (error) =>
                                typeof error === 'object' &&
                                error !== null &&
                                '_tag' in error &&
                                error._tag === 'TransactionFailedError',
                            }),
                          );

                          yield* effect({
                            id,
                            permanent,
                            intent,
                          });
                        }),
                    });
                    return yield* Effect.failCause(cause);
                  }),
                ),
              );

            yield* Option.match(onSuccessLifeCycleHook, {
              onNone: () => Effect.void,
              onSome: (effect) =>
                Effect.gen(function* () {
                  yield* Effect.log('Executing life cycle hook: onSuccess');
                  yield* effect({ id });
                }),
            });

            return result;
          }).pipe(Effect.annotateLogs('transactionId', id));
        }).pipe(
          Effect.annotateLogs({
            networkId,
            feePayer: input.feePayer?.account.address,
          }),
        );

      const getCommittedDetails = (input: { id: TransactionId }) =>
        gatewayApiClient.transaction.getCommittedDetails(input.id);

      const createBadge = (input: {
        account: Account;
        feePayer: Account;
        initialSupply?: number;
      }) =>
        submitTransaction({
          manifest: createBadgeManifest(input.account, input.initialSupply),
          feePayer: {
            account: input.feePayer,
            amount: Amount.make('10'),
          },
        }).pipe(
          Effect.flatMap(({ id }) =>
            getCommittedDetails({
              id,
            }),
          ),
          Effect.map((result) =>
            pipe(
              Option.fromNullishOr(
                result.transaction.balance_changes?.fungible_balance_changes,
              ),
              Option.flatMap(A.head),
              Option.flatMap(R.get('resource_address')),
              Option.getOrThrow,
              FungibleResourceAddress.make,
            ),
          ),
        );

      const createFungibleToken = (input: {
        account: Account;
        feePayer: Account;
        name: string;
        symbol: string;
        initialSupply: Amount;
      }) =>
        submitTransaction({
          manifest: createFungibleTokenManifest(input),
          feePayer: {
            account: input.feePayer,
            amount: Amount.make('10'),
          },
        }).pipe(
          Effect.flatMap(({ id }) =>
            getCommittedDetails({
              id,
            }),
          ),
          Effect.map((result) =>
            pipe(
              Option.fromNullishOr(
                result.transaction.balance_changes?.fungible_balance_changes,
              ),
              Option.flatMap(A.head),
              Option.flatMap(R.get('resource_address')),
              Option.getOrThrow,
              FungibleResourceAddress.make,
            ),
          ),
        );

      const faucet = (input: { account: Account }) =>
        Effect.gen(function* () {
          if (networkId === 1) {
            return yield* new FaucetNotAvailableError({
              message: 'Faucet is only available on Testnet',
            }).pipe(Effect.die);
          }
          return yield* submitTransaction({
            manifest: yield* faucetManifest(input.account.address),
          });
        });

      const submitTransactionV2 = (input: {
        manifest: TransactionManifestString;
        feePayer?: { account: Account; amount: Amount };
        transactionIntent?: TransactionIntentV2;
      }) =>
        submitTransaction({
          ...input,
          version: 'v2',
        });

      return {
        submitTransaction,
        submitTransactionV2,
        getCommittedDetails,
        createBadge,
        createFungibleToken,
        faucet,
      };
    }),
  },
) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(CreateTransactionIntent.Default),
    Layer.provide(CreateTransactionIntentV2.Default),
    Layer.provide(CompileTransaction.Default),
    Layer.provide(SubmitTransaction.Default),
    Layer.provide(TransactionStatus.Default),
    Layer.provide(ManifestHelper.Default),
    Layer.provide(IntentHashService.Default),
    Layer.provide(EpochService.Default),
    Layer.provide(GetFungibleBalance.Default),
    Layer.provide(GetLedgerStateService.Default),
  );
}
