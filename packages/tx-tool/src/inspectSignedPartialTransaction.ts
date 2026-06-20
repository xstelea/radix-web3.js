import {
  Convert,
  RadixEngineToolkit,
  type SignedPartialTransactionV2,
  type SubintentV2,
} from '@steleaio/radix-engine-toolkit';
import { Data, Effect } from 'effect';

export type InspectedSignature = {
  curve: 'Ed25519';
  signature: string;
  publicKey: string;
};

export type SignedPartialTransactionInspection = {
  signedPartialTransaction: SignedPartialTransactionV2;
  rootSubintent: SubintentV2;
  rootSubintentHash: {
    id: string | null;
    hex: string;
  };
  rootSubintentSignatures: InspectedSignature[];
  nonRootSubintentCount: number;
};

export class FailedToInspectSignedPartialTransactionError extends Data.TaggedError(
  'FailedToInspectSignedPartialTransactionError',
)<{
  error: unknown;
}> {}

const inspectSignature = (signature: {
  curve: string;
  signature: Uint8Array;
  publicKey: Uint8Array | undefined;
}): Effect.Effect<
  InspectedSignature,
  FailedToInspectSignedPartialTransactionError
> => {
  if (signature.curve !== 'Ed25519' || signature.publicKey === undefined) {
    return Effect.fail(
      new FailedToInspectSignedPartialTransactionError({
        error: new Error(
          'Only Ed25519 signatures with public keys are supported',
        ),
      }),
    );
  }

  return Effect.succeed({
    curve: 'Ed25519',
    signature: Convert.Uint8Array.toHexString(signature.signature),
    publicKey: Convert.Uint8Array.toHexString(signature.publicKey),
  });
};

export const inspectSignedPartialTransaction = (input: {
  signedPartialTransactionHex: string;
  networkId: number;
}): Effect.Effect<
  SignedPartialTransactionInspection,
  FailedToInspectSignedPartialTransactionError
> =>
  Effect.gen(function* () {
    const signedPartialTransaction = yield* Effect.tryPromise({
      try: () =>
        RadixEngineToolkit.SignedPartialTransactionV2.decompile(
          Convert.HexString.toUint8Array(input.signedPartialTransactionHex),
          input.networkId,
        ),
      catch: (error) =>
        new FailedToInspectSignedPartialTransactionError({ error }),
    });
    const rootSubintent =
      signedPartialTransaction.partialTransaction.rootSubintent;
    const hash = yield* Effect.tryPromise({
      try: () => RadixEngineToolkit.SubintentV2.hash(rootSubintent),
      catch: (error) =>
        new FailedToInspectSignedPartialTransactionError({ error }),
    });

    const rootSubintentSignatures = yield* Effect.forEach(
      signedPartialTransaction.rootSubintentSignatures,
      inspectSignature,
    );

    return {
      signedPartialTransaction,
      rootSubintent,
      rootSubintentHash: {
        id: hash.id,
        hex: Convert.Uint8Array.toHexString(hash.hash),
      },
      rootSubintentSignatures,
      nonRootSubintentCount:
        signedPartialTransaction.partialTransaction.nonRootSubintents.length,
    };
  });
