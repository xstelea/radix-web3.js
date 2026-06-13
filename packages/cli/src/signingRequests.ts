import { Effect } from 'effect';

import {
  PLACEHOLDER_PUBLIC_KEY_HEX,
  PLACEHOLDER_SIGNATURE_HEX,
  type SignatureTemplate,
  type SigningRequest,
  type SigningScope,
} from './schemas';

export type SigningRequestHash = {
  id: string | null;
  hex: string;
};

export type AuthorizationRequirements = {
  rootIntent: string[];
  subintents: Record<string, string[]>;
};

export type GeneratedWorkflowFile<File> = {
  path: string;
  file: File;
};

export type GeneratedSigningRequests = {
  requests: GeneratedWorkflowFile<SigningRequest>[];
  templates: GeneratedWorkflowFile<SignatureTemplate>[];
};

const scopePath = (scope: SigningScope) => {
  switch (scope.kind) {
    case 'rootIntent':
      return 'root';
    case 'subintent':
      return `subintents/${scope.subintentId}`;
    case 'notarySignatory':
      return 'notary-signatory';
    case 'notary':
      return 'notary';
  }
};

const workflowFilePath = (
  directory: 'signing-requests' | 'signature-templates',
  scope: SigningScope,
  account: string | null,
) =>
  account
    ? `${directory}/${scopePath(scope)}/${account}.json`
    : `${directory}/${scopePath(scope)}.json`;

const makeRequestAndTemplate = (input: {
  transactionId: string;
  scope: SigningScope;
  account: string | null;
  hash: SigningRequestHash;
  publicKey?: SignatureTemplate['publicKey'];
}) => {
  const requestPath = workflowFilePath(
    'signing-requests',
    input.scope,
    input.account,
  );
  const templatePath = workflowFilePath(
    'signature-templates',
    input.scope,
    input.account,
  );
  const request: SigningRequest = {
    type: 'signingRequest',
    version: 1,
    transactionId: input.transactionId,
    scope: input.scope,
    account: input.account,
    hash: input.hash,
    signingRequestPath: requestPath,
  };
  const template: SignatureTemplate = {
    type: 'signatureTemplate',
    version: 1,
    transactionId: input.transactionId,
    scope: input.scope,
    account: input.account,
    hash: input.hash,
    signingRequestPath: requestPath,
    publicKey: input.publicKey ?? {
      curve: 'Ed25519',
      hex: PLACEHOLDER_PUBLIC_KEY_HEX,
    },
    signature: {
      curve: 'Ed25519',
      hex: PLACEHOLDER_SIGNATURE_HEX,
    },
  };

  return {
    request: { path: requestPath, file: request },
    template: { path: templatePath, file: template },
  };
};

export const generateSigningRequests = (input: {
  transactionId: string;
  rootIntentHash: SigningRequestHash;
  subintentHashes: Record<string, SigningRequestHash>;
  authorizationAnalysis: AuthorizationRequirements;
  notary: {
    publicKey: SignatureTemplate['publicKey'];
    notaryIsSignatory: boolean;
  };
}): Effect.Effect<GeneratedSigningRequests> =>
  Effect.sync(() => {
    const requests: GeneratedWorkflowFile<SigningRequest>[] = [];
    const templates: GeneratedWorkflowFile<SignatureTemplate>[] = [];
    const push = (item: ReturnType<typeof makeRequestAndTemplate>) => {
      requests.push(item.request);
      templates.push(item.template);
    };

    for (const account of input.authorizationAnalysis.rootIntent) {
      push(
        makeRequestAndTemplate({
          transactionId: input.transactionId,
          scope: { kind: 'rootIntent' },
          account,
          hash: input.rootIntentHash,
        }),
      );
    }

    for (const [subintentId, accounts] of Object.entries(
      input.authorizationAnalysis.subintents,
    )) {
      for (const account of accounts) {
        push(
          makeRequestAndTemplate({
            transactionId: input.transactionId,
            scope: { kind: 'subintent', subintentId },
            account,
            hash: input.subintentHashes[subintentId],
          }),
        );
      }
    }

    if (input.notary.notaryIsSignatory) {
      push(
        makeRequestAndTemplate({
          transactionId: input.transactionId,
          scope: { kind: 'notarySignatory' },
          account: null,
          hash: input.rootIntentHash,
          publicKey: input.notary.publicKey,
        }),
      );
    }

    return { requests, templates };
  });

export class SigningRequestGenerator extends Effect.Service<SigningRequestGenerator>()(
  'SigningRequestGenerator',
  {
    sync: () => ({
      generateSigningRequests,
    }),
  },
) {}
