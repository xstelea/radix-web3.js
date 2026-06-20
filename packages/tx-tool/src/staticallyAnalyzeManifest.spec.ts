import { RadixEngineToolkit } from "@steleaio/radix-engine-toolkit";
import { assert, describe, layer, vi } from "@effect/vitest";
import { Effect } from "effect";
import { NetworkId, TransactionManifestString } from "@radix-effects/shared";
import { faucet } from "./manifests/faucet";
import { type Manifest } from "./schemas";
import {
  StaticallyAnalyzeManifest,
  FailedToStaticallyAnalyzeManifestError,
} from "./staticallyAnalyzeManifest";
import { createAccount } from "./test-helpers/createAccount";

const createProgram = (manifest: Manifest) =>
  Effect.gen(function*() {
    const staticallyAnalyzeManifest = yield* StaticallyAnalyzeManifest;

    return yield* staticallyAnalyzeManifest({
      manifest,
      networkId: NetworkId.make(2),
    });
  });

describe("StaticallyAnalyzeManifest", () => {
  layer(StaticallyAnalyzeManifest.Default)((it) => {
    it.effect("returns static analysis result for a valid manifest", () =>
      Effect.gen(function*() {
        const account = yield* createAccount({ networkId: 2 });
        const manifestString = yield* faucet(account.address);

        const manifest: Manifest = {
          instructions: {
            kind: "String",
            value: manifestString,
          },
          blobs: [],
        };

        const result = yield* createProgram(manifest);

        assert.isTrue(Array.isArray(result.classification));
        assert.isTrue(Array.isArray(result.encountered_entities));
      }),
    );

    it.effect("maps toolkit promise rejection to tagged error", () =>
      Effect.gen(function*() {
        const spy = yield* Effect.sync(() =>
          vi
            .spyOn(RadixEngineToolkit.TransactionManifest, "staticallyAnalyze")
            .mockRejectedValueOnce(new Error("boom")),
        );

        const manifest: Manifest = {
          instructions: {
            kind: "String",
            value: TransactionManifestString.make(
              'CALL_METHOD Address("account_tdx_2_1xxxxxxxxx") "lock_fee" Decimal("1") ;',
            ),
          },
          blobs: [],
        };

        const error = yield* Effect.flip(createProgram(manifest)).pipe(
          Effect.ensuring(Effect.sync(() => spy.mockRestore())),
        );

        assert.strictEqual(
          error._tag,
          "FailedToStaticallyAnalyzeManifestError",
        );
        assert.instanceOf(error, FailedToStaticallyAnalyzeManifestError);
      }),
    );
  });
});
