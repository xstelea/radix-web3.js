import {
  Convert,
  RadixEngineToolkit,
  SignatureWithPublicKey,
  type SignedPartialTransactionV2,
  type SubintentV2,
} from '@steleaio/radix-engine-toolkit';
import { describe, expect, it } from 'vitest';
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
  it('derives root subintent details from signed partial transaction bytes', async () => {
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
    const compiled = await RadixEngineToolkit.SignedPartialTransactionV2.compile(
      signedPartialTransaction,
    );
    const expectedHash =
      await RadixEngineToolkit.SubintentV2.hash(rootSubintent);

    const inspection = await inspectSignedPartialTransaction({
      networkId: 1,
      signedPartialTransactionHex: Convert.Uint8Array.toHexString(compiled),
    });

    expect(inspection.rootSubintentHash).toEqual({
      id: expectedHash.id,
      hex: Convert.Uint8Array.toHexString(expectedHash.hash),
    });
    expect(inspection.rootSubintent.intentCore.header).toEqual(
      rootSubintent.intentCore.header,
    );
    expect(inspection.rootSubintent.intentCore.instructions.trim()).toBe(
      'YIELD_TO_PARENT;',
    );
    expect(inspection.rootSubintentSignatures).toEqual([
      {
        curve: 'Ed25519',
        signature: signatureHex,
        publicKey: publicKeyHex,
      },
    ]);
    expect(inspection.nonRootSubintentCount).toBe(0);
  });
});
