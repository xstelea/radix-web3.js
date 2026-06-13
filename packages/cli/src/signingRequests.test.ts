import { it } from '@effect/vitest';
import { Effect, Schema } from 'effect';
import { describe, expect } from 'vitest';

import {
  PLACEHOLDER_PUBLIC_KEY_HEX,
  PLACEHOLDER_SIGNATURE_HEX,
  SignatureTemplateSchema,
  SigningRequestSchema,
} from './schemas';
import { generateSigningRequests } from './signingRequests';

const notaryPublicKey = {
  curve: 'Ed25519' as const,
  hex: '1111111111111111111111111111111111111111111111111111111111111111',
};

describe('signing request generation', () => {
  it.effect('generates account-scoped root and subintent requests', () =>
    Effect.gen(function* () {
      const result = yield* generateSigningRequests({
        transactionId: 'txid',
        rootIntentHash: { id: 'intent_root', hex: 'aa' },
        subintentHashes: {
          child: { id: 'sub_child', hex: 'bb' },
        },
        authorizationAnalysis: {
          rootIntent: ['account_rdx1root'],
          subintents: {
            child: ['account_rdx1child'],
          },
        },
        notary: {
          publicKey: notaryPublicKey,
          notaryIsSignatory: false,
        },
      });

      expect(result.requests.map((item) => item.path)).toEqual([
        'signing-requests/root/account_rdx1root.json',
        'signing-requests/subintents/child/account_rdx1child.json',
      ]);
      for (const request of result.requests) {
        Schema.decodeUnknownSync(SigningRequestSchema)(request.file);
      }
    }),
  );

  it.effect('does not generate account requests for auth-free scopes', () =>
    Effect.gen(function* () {
      const result = yield* generateSigningRequests({
        transactionId: 'txid',
        rootIntentHash: { id: 'intent_root', hex: 'aa' },
        subintentHashes: {},
        authorizationAnalysis: {
          rootIntent: [],
          subintents: {},
        },
        notary: {
          publicKey: notaryPublicKey,
          notaryIsSignatory: false,
        },
      });

      expect(result.requests).toEqual([]);
      expect(result.templates).toEqual([]);
    }),
  );

  it.effect('generates placeholder account templates', () =>
    Effect.gen(function* () {
      const result = yield* generateSigningRequests({
        transactionId: 'txid',
        rootIntentHash: { id: 'intent_root', hex: 'aa' },
        subintentHashes: {},
        authorizationAnalysis: {
          rootIntent: ['account_rdx1root'],
          subintents: {},
        },
        notary: {
          publicKey: notaryPublicKey,
          notaryIsSignatory: false,
        },
      });

      const template = Schema.decodeUnknownSync(SignatureTemplateSchema)(
        result.templates[0].file,
      );
      expect(template.publicKey.hex).toBe(PLACEHOLDER_PUBLIC_KEY_HEX);
      expect(template.signature.hex).toBe(PLACEHOLDER_SIGNATURE_HEX);
    }),
  );

  it.effect('generates notary-signatory request by default', () =>
    Effect.gen(function* () {
      const result = yield* generateSigningRequests({
        transactionId: 'txid',
        rootIntentHash: { id: 'intent_root', hex: 'aa' },
        subintentHashes: {},
        authorizationAnalysis: {
          rootIntent: [],
          subintents: {},
        },
        notary: {
          publicKey: notaryPublicKey,
          notaryIsSignatory: true,
        },
      });

      expect(result.requests).toHaveLength(1);
      expect(result.requests[0].file.scope).toEqual({
        kind: 'notarySignatory',
      });
      expect(result.templates[0].file.publicKey).toEqual(notaryPublicKey);
      expect(result.templates[0].path).toBe(
        'signature-templates/notary-signatory.json',
      );
    }),
  );
});
