import { assert, describe, it } from '@effect/vitest';
import { Effect, Schema } from 'effect';

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

      assert.deepEqual(
        result.requests.map((item) => item.path),
        [
          'signing-requests/root/account_rdx1root.json',
          'signing-requests/subintents/child/account_rdx1child.json',
        ],
      );
      assert.deepEqual(
        result.templates.map((item) => item.path),
        [
          'signature-templates/root/account_rdx1root.json',
          'signature-templates/subintents/child/account_rdx1child.json',
        ],
      );
      for (const request of result.requests) {
        Schema.decodeUnknownSync(SigningRequestSchema)(request.file);
      }
      for (const template of result.templates) {
        const decoded = Schema.decodeUnknownSync(SignatureTemplateSchema)(
          template.file,
        );
        assert.deepEqual(decoded, template.file);
      }
      assert.strictEqual(
        result.templates[0].file.signingRequestPath,
        result.requests[0].path,
      );
      assert.strictEqual(
        result.templates[1].file.signingRequestPath,
        result.requests[1].path,
      );
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

      assert.deepEqual(result.requests, []);
      assert.deepEqual(result.templates, []);
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
      assert.strictEqual(template.publicKey.hex, PLACEHOLDER_PUBLIC_KEY_HEX);
      assert.strictEqual(template.signature.hex, PLACEHOLDER_SIGNATURE_HEX);
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

      assert.lengthOf(result.requests, 1);
      assert.deepEqual(result.requests[0].file.scope, {
        kind: 'notarySignatory',
      });
      assert.deepEqual(result.templates[0].file.publicKey, notaryPublicKey);
      assert.strictEqual(
        result.templates[0].path,
        'signature-templates/notary-signatory.json',
      );
    }),
  );
});
