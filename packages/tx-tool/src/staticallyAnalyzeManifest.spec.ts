import { RadixEngineToolkit } from "@steleaio/radix-engine-toolkit";
import { Effect } from "effect";
import { NetworkId, TransactionManifestString } from "@radix-effects/shared";
import { describe, expect, it, vi } from "vitest";
import { faucet } from "./manifests/faucet";
import { type Manifest } from "./schemas";
import {
  StaticallyAnalyzeManifest,
  FailedToStaticallyAnalyzeManifestError,
} from "./staticallyAnalyzeManifest";
import { createAccount } from "./test-helpers/createAccount";

const createProgram = (manifest: Manifest) =>
  Effect.gen(function* () {
    const staticallyAnalyzeManifest = yield* StaticallyAnalyzeManifest;

    return yield* staticallyAnalyzeManifest({
      manifest,
      networkId: NetworkId.make(2),
    });
  }).pipe(Effect.provide(StaticallyAnalyzeManifest.Default));

describe("StaticallyAnalyzeManifest", () => {
  it("returns static analysis result for a valid manifest", async () => {
    const account = await Effect.runPromise(createAccount({ networkId: 2 }));
    const manifestString = await Effect.runPromise(faucet(account.address));

    const manifest: Manifest = {
      instructions: {
        kind: "String",
        value: manifestString,
      },
      blobs: [],
    };

    const result = await Effect.runPromise(createProgram(manifest));

    expect(Array.isArray(result.classification)).toBe(true);
    expect(Array.isArray(result.encountered_entities)).toBe(true);
  });

  it("maps toolkit promise rejection to tagged error", async () => {
    const spy = vi
      .spyOn(RadixEngineToolkit.TransactionManifest, "staticallyAnalyze")
      .mockRejectedValueOnce(new Error("boom"));

    const manifest: Manifest = {
      instructions: {
        kind: "String",
        value: TransactionManifestString.make(
          'CALL_METHOD Address("account_tdx_2_1xxxxxxxxx") "lock_fee" Decimal("1") ;',
        ),
      },
      blobs: [],
    };

    const error = await Effect.runPromise(Effect.flip(createProgram(manifest)));

    expect(error._tag).toBe("FailedToStaticallyAnalyzeManifestError");
    expect(error).toBeInstanceOf(FailedToStaticallyAnalyzeManifestError);

    spy.mockRestore();
  });
});
