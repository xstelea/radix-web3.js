import { PublicKey, RadixEngineToolkit } from "@steleaio/radix-engine-toolkit";
import { assert, describe, layer, vi } from "@effect/vitest";
import { Effect } from "effect";
import {
  Epoch,
  NetworkId,
  TransactionManifestString,
} from "@radix-effects/shared";
import { faucet } from "./manifests/faucet";
import { TransactionIntentV2Schema, type TransactionIntentV2 } from "./schemas";
import {
  FailedToStaticallyAnalyzeManifestV2Error,
  StaticallyAnalyzeManifestV2,
} from "./staticallyAnalyzeManifestV2";
import { createAccount } from "./test-helpers/createAccount";

const createProgram = (intent: TransactionIntentV2) =>
  Effect.gen(function*() {
    const staticallyAnalyzeManifestV2 = yield* StaticallyAnalyzeManifestV2;

    return yield* staticallyAnalyzeManifestV2({
      intent,
    });
  });

describe("StaticallyAnalyzeManifestV2", () => {
  layer(StaticallyAnalyzeManifestV2.Default)((it) => {
    it.effect("returns static analysis result for a valid transaction intent v2", () =>
      Effect.gen(function*() {
        const account = yield* createAccount({ networkId: 2 });
        const manifest = yield* faucet(account.address);

        const intent = TransactionIntentV2Schema.make({
          transactionHeader: {
            notaryPublicKey: new PublicKey.Ed25519(account.publicKeyHex),
            notaryIsSignatory: false,
            tipBasisPoints: 0,
          },
          rootIntentCore: {
            header: {
              networkId: NetworkId.make(2),
              startEpochInclusive: Epoch.make(1),
              endEpochExclusive: Epoch.make(100),
              minProposerTimestampInclusive: undefined,
              maxProposerTimestampExclusive: undefined,
              intentDiscriminator: Date.now(),
            },
            instructions: manifest,
            blobs: [],
            message: { kind: "None" as const },
            children: [],
          },
          nonRootSubintents: [],
        });

        const result = yield* createProgram(intent);

        assert.isTrue(Array.isArray(result.root_intent.classification));
        assert.isTrue(Array.isArray(result.non_root_subintents));
      }),
    );

    it.effect("maps toolkit promise rejection to tagged error", () =>
      Effect.gen(function*() {
        const spy = yield* Effect.sync(() =>
          vi
            .spyOn(RadixEngineToolkit.TransactionIntentV2, "staticallyAnalyze")
            .mockRejectedValueOnce(new Error("boom")),
        );

        const intent = TransactionIntentV2Schema.make({
          transactionHeader: {
            notaryPublicKey: new PublicKey.Ed25519(
              "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
            ),
            notaryIsSignatory: false,
            tipBasisPoints: 0,
          },
          rootIntentCore: {
            header: {
              networkId: NetworkId.make(2),
              startEpochInclusive: Epoch.make(1),
              endEpochExclusive: Epoch.make(100),
              minProposerTimestampInclusive: undefined,
              maxProposerTimestampExclusive: undefined,
              intentDiscriminator: 1,
            },
            instructions: TransactionManifestString.make(
              'CALL_METHOD Address("account_tdx_2_1xxxxxxxxx") "lock_fee" Decimal("1") ;',
            ),
            blobs: [],
            message: { kind: "None" as const },
            children: [],
          },
          nonRootSubintents: [],
        });

        const error = yield* Effect.flip(createProgram(intent)).pipe(
          Effect.ensuring(Effect.sync(() => spy.mockRestore())),
        );

        assert.strictEqual(
          error._tag,
          "FailedToStaticallyAnalyzeManifestV2Error",
        );
        assert.instanceOf(error, FailedToStaticallyAnalyzeManifestV2Error);
      }),
    );
  });
});
