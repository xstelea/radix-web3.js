import {
  Convert,
  RadixEngineToolkit,
  type SignedPartialTransactionV2,
  type SubintentV2,
} from '@steleaio/radix-engine-toolkit';

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

const inspectSignature = (signature: {
  curve: string;
  signature: Uint8Array;
  publicKey: Uint8Array | undefined;
}): InspectedSignature => {
  if (signature.curve !== 'Ed25519' || signature.publicKey === undefined) {
    throw new Error('Only Ed25519 signatures with public keys are supported');
  }

  return {
    curve: 'Ed25519',
    signature: Convert.Uint8Array.toHexString(signature.signature),
    publicKey: Convert.Uint8Array.toHexString(signature.publicKey),
  };
};

export const inspectSignedPartialTransaction = async (input: {
  signedPartialTransactionHex: string;
  networkId: number;
}): Promise<SignedPartialTransactionInspection> => {
  const signedPartialTransaction =
    await RadixEngineToolkit.SignedPartialTransactionV2.decompile(
      Convert.HexString.toUint8Array(input.signedPartialTransactionHex),
      input.networkId,
    );
  const rootSubintent =
    signedPartialTransaction.partialTransaction.rootSubintent;
  const hash = await RadixEngineToolkit.SubintentV2.hash(rootSubintent);

  return {
    signedPartialTransaction,
    rootSubintent,
    rootSubintentHash: {
      id: hash.id,
      hex: Convert.Uint8Array.toHexString(hash.hash),
    },
    rootSubintentSignatures:
      signedPartialTransaction.rootSubintentSignatures.map(inspectSignature),
    nonRootSubintentCount:
      signedPartialTransaction.partialTransaction.nonRootSubintents.length,
  };
};
