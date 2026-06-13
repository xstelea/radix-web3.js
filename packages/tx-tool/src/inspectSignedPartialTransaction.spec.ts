import {
  Convert,
  RadixEngineToolkit,
  SignatureWithPublicKey,
  type SignedPartialTransactionV2,
  type SubintentV2,
} from '@steleaio/radix-engine-toolkit';
import { assert, describe, it } from '@effect/vitest';
import { Effect } from 'effect';
import { inspectSignedPartialTransaction } from './inspectSignedPartialTransaction';

const publicKeyHex =
  '1111111111111111111111111111111111111111111111111111111111111111';
const signatureHex =
  '22222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222';

const rootSubintent = {
  intentCore: {
    header: {
      networkId: 1,
      startEpochInclusive: 1,
      endEpochExclusive: 10,
      intentDiscriminator: 123,
    },
    instructions: 'YIELD_TO_PARENT;',
    blobs: [],
    message: { kind: 'None' },
    children: [],
  },
} satisfies SubintentV2;

describe('Signed Partial Transaction Inspection', () => {
  it.effect('derives root subintent details from signed partial transaction bytes', () =>
    Effect.gen(function* () {
      const signedPartialTransaction = {
        partialTransaction: {
          rootSubintent,
          nonRootSubintents: [],
        },
        rootSubintentSignatures: [
          new SignatureWithPublicKey.Ed25519(signatureHex, publicKeyHex),
        ],
        nonRootSubintentSignatures: [],
      } satisfies SignedPartialTransactionV2;
      const compiled = yield* Effect.tryPromise(() =>
        RadixEngineToolkit.SignedPartialTransactionV2.compile(
          signedPartialTransaction,
        ),
      );
      const expectedHash = yield* Effect.tryPromise(() =>
        RadixEngineToolkit.SubintentV2.hash(rootSubintent),
      );

      const inspection = yield* inspectSignedPartialTransaction({
        networkId: 1,
        signedPartialTransactionHex: Convert.Uint8Array.toHexString(compiled),
      });

      assert.deepEqual(inspection.rootSubintentHash, {
        id: expectedHash.id,
        hex: Convert.Uint8Array.toHexString(expectedHash.hash),
      });
      assert.strictEqual(
        inspection.rootSubintent.intentCore.header.networkId,
        rootSubintent.intentCore.header.networkId,
      );
      assert.strictEqual(
        inspection.rootSubintent.intentCore.header.startEpochInclusive,
        rootSubintent.intentCore.header.startEpochInclusive,
      );
      assert.strictEqual(
        inspection.rootSubintent.intentCore.header.endEpochExclusive,
        rootSubintent.intentCore.header.endEpochExclusive,
      );
      assert.strictEqual(
        inspection.rootSubintent.intentCore.header.intentDiscriminator,
        rootSubintent.intentCore.header.intentDiscriminator,
      );
      assert.strictEqual(
        inspection.rootSubintent.intentCore.instructions.trim(),
        'YIELD_TO_PARENT;',
      );
      assert.deepEqual(inspection.rootSubintentSignatures, [
        {
          curve: 'Ed25519',
          signature: signatureHex,
          publicKey: publicKeyHex,
        },
      ]);
      assert.strictEqual(inspection.nonRootSubintentCount, 0);
    }),
  );
});
