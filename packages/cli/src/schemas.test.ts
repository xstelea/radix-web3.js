import { it } from '@effect/vitest';
import { Effect, Schema } from 'effect';
import { describe, expect } from 'vitest';

import {
  PLACEHOLDER_PUBLIC_KEY_HEX,
  PLACEHOLDER_SIGNATURE_HEX,
  PublicKeySchema,
  SignatureFileSchema,
  SignatureTemplateSchema,
  SigningRequestSchema,
  SubintentsFileSchema,
} from './schemas';

const ed25519PublicKey =
  '1111111111111111111111111111111111111111111111111111111111111111';
const ed25519Signature =
  '22222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222';

describe('CLI workflow schemas', () => {
  it.effect('requires typed workflow files with versions', () =>
    Effect.sync(() => {
      expect(() =>
        Schema.decodeUnknownSync(SigningRequestSchema)({
          version: 1,
          transactionId: 'txid',
          scope: { kind: 'rootIntent' },
          account: null,
          hash: { id: 'intent', hex: 'aa' },
        }),
      ).toThrow();

      expect(() =>
        Schema.decodeUnknownSync(SigningRequestSchema)({
          type: 'signingRequest',
          transactionId: 'txid',
          scope: { kind: 'rootIntent' },
          account: null,
          hash: { id: 'intent', hex: 'aa' },
        }),
      ).toThrow();
    }),
  );

  it.effect('accepts Ed25519 public keys and rejects unsupported curves', () =>
    Effect.sync(() => {
      expect(
        Schema.decodeUnknownSync(PublicKeySchema)({
          curve: 'Ed25519',
          hex: ed25519PublicKey,
        }),
      ).toEqual({
        curve: 'Ed25519',
        hex: ed25519PublicKey,
      });

      expect(() =>
        Schema.decodeUnknownSync(PublicKeySchema)({
          curve: 'Secp256k1',
          hex: ed25519PublicKey,
        }),
      ).toThrow();
    }),
  );

  it.effect(
    'rejects unchanged template placeholders in submitted signature files',
    () =>
      Effect.sync(() => {
        expect(
          Schema.decodeUnknownSync(SignatureTemplateSchema)({
            type: 'signatureTemplate',
            version: 1,
            transactionId: 'txid',
            scope: { kind: 'rootIntent' },
            account: 'account_rdx1...',
            hash: { id: 'intent', hex: 'aa' },
            publicKey: { curve: 'Ed25519', hex: PLACEHOLDER_PUBLIC_KEY_HEX },
            signature: { curve: 'Ed25519', hex: PLACEHOLDER_SIGNATURE_HEX },
          }).publicKey.hex,
        ).toBe(PLACEHOLDER_PUBLIC_KEY_HEX);

        expect(() =>
          Schema.decodeUnknownSync(SignatureFileSchema)({
            type: 'signatureFile',
            version: 1,
            transactionId: 'txid',
            signatures: [
              {
                scope: { kind: 'rootIntent' },
                account: 'account_rdx1...',
                hash: { id: 'intent', hex: 'aa' },
                publicKey: {
                  curve: 'Ed25519',
                  hex: PLACEHOLDER_PUBLIC_KEY_HEX,
                },
                signature: { curve: 'Ed25519', hex: ed25519Signature },
              },
            ],
          }),
        ).toThrow();
      }),
  );

  it.effect('validates direct child subintent IDs conservatively', () =>
    Effect.sync(() => {
      expect(
        Schema.decodeUnknownSync(SubintentsFileSchema)({
          type: 'subintents',
          version: 1,
          subintents: {
            child_1: { manifest: 'child.rtm' },
            'Child-2': { manifest: 'other.rtm' },
          },
        }),
      ).toMatchObject({
        subintents: {
          child_1: { manifest: 'child.rtm' },
        },
      });

      expect(() =>
        Schema.decodeUnknownSync(SubintentsFileSchema)({
          type: 'subintents',
          version: 1,
          subintents: {
            'bad id': { manifest: 'child.rtm' },
          },
        }),
      ).toThrow();
    }),
  );

  it.effect('rejects invalid signing scopes', () =>
    Effect.sync(() => {
      expect(() =>
        Schema.decodeUnknownSync(SigningRequestSchema)({
          type: 'signingRequest',
          version: 1,
          transactionId: 'txid',
          scope: { kind: 'subintent' },
          account: null,
          hash: { id: 'intent', hex: 'aa' },
        }),
      ).toThrow();
    }),
  );
});
