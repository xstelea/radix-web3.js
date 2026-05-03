import { PublicKey, RadixEngineToolkit } from "@steleaio/radix-engine-toolkit";
import { Effect } from "effect";
import {
  Epoch,
  NetworkId,
  TransactionManifestString,
} from "@radix-effects/shared";
import { describe, expect, it, vi } from "vitest";
import { faucet } from "./manifests/faucet";
import { TransactionIntentV2Schema, type TransactionIntentV2 } from "./schemas";
import {
  FailedToStaticallyAnalyzeManifestV2Error,
  StaticallyAnalyzeManifestV2,
} from "./staticallyAnalyzeManifestV2";
import { createAccount } from "./test-helpers/createAccount";

const createProgram = (intent: TransactionIntentV2) =>
  Effect.gen(function* () {
    const staticallyAnalyzeManifestV2 = yield* StaticallyAnalyzeManifestV2;

    return yield* staticallyAnalyzeManifestV2({
      intent,
    });
  }).pipe(Effect.provide(StaticallyAnalyzeManifestV2.Default));

describe("StaticallyAnalyzeManifestV2", () => {
  it("returns static analysis result for a valid transaction intent v2", async () => {
    const account = await Effect.runPromise(createAccount({ networkId: 2 }));
    const manifest = await Effect.runPromise(faucet(account.address));

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

    const result = await Effect.runPromise(createProgram(intent));

    expect(Array.isArray(result.root_intent.classification)).toBe(true);
    expect(Array.isArray(result.non_root_subintents)).toBe(true);
  });

  it("maps toolkit promise rejection to tagged error", async () => {
    const spy = vi
      .spyOn(RadixEngineToolkit.TransactionIntentV2, "staticallyAnalyze")
      .mockRejectedValueOnce(new Error("boom"));

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

    const error = await Effect.runPromise(Effect.flip(createProgram(intent)));

    expect(error._tag).toBe("FailedToStaticallyAnalyzeManifestV2Error");
    expect(error).toBeInstanceOf(FailedToStaticallyAnalyzeManifestV2Error);

    spy.mockRestore();
  });
});
