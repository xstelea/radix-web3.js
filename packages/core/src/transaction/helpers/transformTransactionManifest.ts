import {
  RadixEngineToolkit,
  type TransactionManifest,
} from '@radixdlt/radix-engine-toolkit';

export const transformTransactionManifest = async ({
  networkId,
  transactionManifest,
  blobs = [],
}: {
  networkId: number;
  transactionManifest: TransactionManifest | string;
  blobs?: Uint8Array[];
}) => {
  if (typeof transactionManifest === 'string') {
    const instructions = await RadixEngineToolkit.Instructions.convert(
      { kind: 'String', value: transactionManifest },
      networkId,
      'Parsed',
    );
    return { instructions, blobs };
  }
  return transactionManifest;
};
