import {
  PLACEHOLDER_PUBLIC_KEY_HEX,
  PLACEHOLDER_SIGNATURE_HEX,
  type SignatureFile,
  type SignatureTemplate,
  type SigningRequest,
} from './schemas';

export type TemplateKind =
  | 'subintents'
  | 'signing-request'
  | 'signature-template'
  | 'signature-file';

const sampleHash = {
  id: 'intent_or_subintent_hash_id',
  hex: 'aa',
};

const sampleScope = { kind: 'rootIntent' as const };

export const workflowTemplate = (kind: TemplateKind) => {
  switch (kind) {
    case 'subintents':
      return {
        type: 'subintents',
        version: 1,
        subintents: {
          child_one: {
            manifest: 'child-one.rtm',
          },
        },
      };
    case 'signing-request':
      return {
        type: 'signingRequest',
        version: 1,
        transactionId: 'txid...',
        scope: sampleScope,
        account: 'account_rdx1...',
        hash: sampleHash,
        signingRequestPath: 'signing-requests/root/account_rdx1....json',
      } satisfies SigningRequest;
    case 'signature-template':
      return {
        type: 'signatureTemplate',
        version: 1,
        transactionId: 'txid...',
        scope: sampleScope,
        account: 'account_rdx1...',
        hash: sampleHash,
        signingRequestPath: 'signing-requests/root/account_rdx1....json',
        publicKey: {
          curve: 'Ed25519',
          hex: PLACEHOLDER_PUBLIC_KEY_HEX,
        },
        signature: {
          curve: 'Ed25519',
          hex: PLACEHOLDER_SIGNATURE_HEX,
        },
      } satisfies SignatureTemplate;
    case 'signature-file':
      return {
        type: 'signatureFile',
        version: 1,
        transactionId: 'txid...',
        signatures: [],
      } satisfies SignatureFile;
  }
};
