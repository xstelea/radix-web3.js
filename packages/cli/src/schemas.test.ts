import { assert, describe, it } from '@effect/vitest';
import { Schema } from 'effect';

import {
  BatchSignatureFileSchema,
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
  it('requires typed workflow files with versions', () => {
    assert.throws(() =>
      Schema.decodeUnknownSync(SigningRequestSchema)({
        version: 1,
        transactionId: 'txid',
        scope: { kind: 'rootIntent' },
        account: null,
        hash: { id: 'intent', hex: 'aa' },
      }),
    );

    assert.throws(() =>
      Schema.decodeUnknownSync(SigningRequestSchema)({
        type: 'signingRequest',
        transactionId: 'txid',
        scope: { kind: 'rootIntent' },
        account: null,
        hash: { id: 'intent', hex: 'aa' },
      }),
    );
  });

  it('accepts Ed25519 public keys and rejects unsupported curves', () => {
    assert.deepEqual(
      Schema.decodeUnknownSync(PublicKeySchema)({
        curve: 'Ed25519',
        hex: ed25519PublicKey,
      }),
      {
        curve: 'Ed25519',
        hex: ed25519PublicKey,
      },
    );

    assert.throws(() =>
      Schema.decodeUnknownSync(PublicKeySchema)({
        curve: 'Secp256k1',
        hex: ed25519PublicKey,
      }),
    );
  });

  it('rejects unchanged template placeholders in submitted signature files', () => {
    assert.strictEqual(
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
      PLACEHOLDER_PUBLIC_KEY_HEX,
    );

    assert.throws(() =>
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
    );
  });

  it('requires batch signature files to contain at least one signature file', () => {
    const signatureFile = Schema.decodeUnknownSync(SignatureFileSchema)({
      type: 'signatureFile',
      version: 1,
      transactionId: 'txid',
      signatures: [],
    });

    assert.deepEqual(
      Schema.decodeUnknownSync(BatchSignatureFileSchema)({
        type: 'batchSignatureFile',
        version: 1,
        signatures: [signatureFile],
      }),
      {
        type: 'batchSignatureFile',
        version: 1,
        signatures: [signatureFile],
      },
    );

    assert.throws(() =>
      Schema.decodeUnknownSync(BatchSignatureFileSchema)({
        type: 'batchSignatureFile',
        version: 1,
        signatures: [],
      }),
    );
  });

  it('validates direct child subintent IDs conservatively', () => {
    const decoded = Schema.decodeUnknownSync(SubintentsFileSchema)({
      type: 'subintents',
      version: 1,
      subintents: {
        child_1: { manifest: 'child.rtm' },
        'Child-2': { manifest: 'other.rtm' },
      },
    });

    assert.deepEqual(decoded.subintents.child_1, { manifest: 'child.rtm' });
    assert.deepEqual(decoded.subintents['Child-2'], { manifest: 'other.rtm' });

    assert.throws(() =>
      Schema.decodeUnknownSync(SubintentsFileSchema)({
        type: 'subintents',
        version: 1,
        subintents: {
          'bad id': { manifest: 'child.rtm' },
        },
      }),
    );
  });

  it('rejects invalid signing scopes', () => {
    assert.throws(() =>
      Schema.decodeUnknownSync(SigningRequestSchema)({
        type: 'signingRequest',
        version: 1,
        transactionId: 'txid',
        scope: { kind: 'subintent' },
        account: null,
        hash: { id: 'intent', hex: 'aa' },
      }),
    );
  });
});
