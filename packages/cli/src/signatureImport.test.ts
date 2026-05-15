import { it } from '@effect/vitest';
import { ed25519 } from '@noble/curves/ed25519';
import { Effect } from 'effect';
import { describe, expect } from 'vitest';
import {
  PLACEHOLDER_PUBLIC_KEY_HEX,
  PLACEHOLDER_SIGNATURE_HEX,
  type SigningRequest,
} from './schemas';
import { importSignatures } from './signatureImport';

const privateKey = new Uint8Array(32).fill(1);
const hashHex = 'aabbcc';
const publicKeyHex = Buffer.from(ed25519.getPublicKey(privateKey)).toString(
  'hex',
);
const signatureHex = Buffer.from(
  ed25519.sign(Buffer.from(hashHex, 'hex'), privateKey),
).toString('hex');

const request: SigningRequest = {
  type: 'signingRequest',
  version: 1,
  transactionId: 'txid',
  scope: { kind: 'rootIntent' },
  account: 'account_rdx1...',
  hash: { id: 'intent', hex: hashHex },
  signingRequestPath: 'signing-requests/root/account_rdx1....json',
};

describe('signature import', () => {
  it.effect('accepts locally verifiable Ed25519 signatures', () =>
    Effect.gen(function* () {
      const result = yield* importSignatures({
        transactionId: 'txid',
        generatedRequests: [request],
        existing: [],
        files: [
          {
            type: 'signatureFile',
            version: 1,
            transactionId: 'txid',
            signatures: [
              {
                scope: request.scope,
                account: request.account,
                hash: request.hash,
                publicKey: { curve: 'Ed25519', hex: publicKeyHex },
                signature: { curve: 'Ed25519', hex: signatureHex },
              },
            ],
          },
        ],
      });

      expect(result.acceptedCount).toBe(1);
      expect(result.signatureFile.signatures).toHaveLength(1);
    }),
  );

  it.effect('rejects signatures without a generated signing request', () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(
        importSignatures({
          transactionId: 'txid',
          generatedRequests: [],
          existing: [],
          files: [
            {
              type: 'signatureFile',
              version: 1,
              transactionId: 'txid',
              signatures: [
                {
                  scope: request.scope,
                  account: request.account,
                  hash: request.hash,
                  publicKey: { curve: 'Ed25519', hex: publicKeyHex },
                  signature: { curve: 'Ed25519', hex: signatureHex },
                },
              ],
            },
          ],
        }),
      );

      expect(result._tag).toBe('Failure');
    }),
  );

  it.effect('rejects unchanged filled-template placeholders', () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(
        importSignatures({
          transactionId: 'txid',
          generatedRequests: [request],
          existing: [],
          files: [
            {
              type: 'signatureTemplate',
              version: 1,
              transactionId: 'txid',
              scope: request.scope,
              account: request.account,
              hash: request.hash,
              publicKey: {
                curve: 'Ed25519',
                hex: PLACEHOLDER_PUBLIC_KEY_HEX,
              },
              signature: {
                curve: 'Ed25519',
                hex: PLACEHOLDER_SIGNATURE_HEX,
              },
            },
          ],
        }),
      );

      expect(result._tag).toBe('Failure');
    }),
  );

  it.effect('rejects signatures that fail local verification', () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(
        importSignatures({
          transactionId: 'txid',
          generatedRequests: [request],
          existing: [],
          files: [
            {
              type: 'signatureFile',
              version: 1,
              transactionId: 'txid',
              signatures: [
                {
                  scope: request.scope,
                  account: request.account,
                  hash: request.hash,
                  publicKey: { curve: 'Ed25519', hex: publicKeyHex },
                  signature: {
                    curve: 'Ed25519',
                    hex: '44'.repeat(64),
                  },
                },
              ],
            },
          ],
        }),
      );

      expect(result._tag).toBe('Failure');
    }),
  );
});
