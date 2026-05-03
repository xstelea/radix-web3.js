import { layer } from '@effect/vitest';
import { PrivateKey } from '@steleaio/radix-engine-toolkit';
import { Effect, Layer, Redacted } from 'effect';
import {
  Epoch,
  HexString,
  NetworkId,
  Nonce,
} from '@radix-effects/shared';
import { CompileTransaction } from './compileTransaction';
import { faucet } from './manifests/faucet';
import { TransactionHeaderSchema, TransactionHeaderV2Schema, TransactionIntentSchema, TransactionIntentV2Schema } from './schemas';
import { Signer } from './signer/signer';
import { createAccount } from './test-helpers/createAccount';

const notaryPrivateKeyHex = HexString.make(
  'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
);

const signerLayer = Signer.makePrivateKeySigner(
  Redacted.make(
    notaryPrivateKeyHex,
  ),
);

const testLayer = CompileTransaction.Default.pipe(Layer.provide(signerLayer));
const notaryPublicKey = new PrivateKey.Ed25519(notaryPrivateKeyHex).publicKey();

layer(testLayer)('CompileTransaction', (it) => {
  it.effect('compiles v1 intents', () =>
    Effect.gen(function* () {
      const compileTransaction = yield* CompileTransaction;
      const account = yield* createAccount({ networkId: 2 });
      const manifest = yield* faucet(account.address);

      const intent = TransactionIntentSchema.make({
        header: TransactionHeaderSchema.make({
          networkId: NetworkId.make(2),
          startEpochInclusive: Epoch.make(1),
          endEpochExclusive: Epoch.make(3),
          notaryPublicKey,
          nonce: Nonce.make(1),
          notaryIsSignatory: false,
          tipPercentage: 0,
        }),
        message: { kind: 'None' as const },
        manifest: {
          instructions: {
            kind: 'String' as const,
            value: manifest,
          },
          blobs: [],
        },
      });

      const compiled = yield* compileTransaction({
        intent,
        signatures: [],
      });

      expect(compiled).toBeInstanceOf(Uint8Array);
      expect(compiled.length).toBeGreaterThan(0);
    }),
  );

  it.effect('compiles v2 intents', () =>
    Effect.gen(function* () {
      const compileTransaction = yield* CompileTransaction;
      const account = yield* createAccount({ networkId: 2 });
      const manifest = yield* faucet(account.address);

      const intent = TransactionIntentV2Schema.make({
        transactionHeader: TransactionHeaderV2Schema.make({
          notaryPublicKey,
          notaryIsSignatory: false,
          tipBasisPoints: 0,
        }),
        rootIntentCore: {
          header: {
            networkId: NetworkId.make(2),
            startEpochInclusive: Epoch.make(1),
            endEpochExclusive: Epoch.make(3),
            intentDiscriminator: 0,
          },
          instructions: manifest,
          blobs: [],
          message: { kind: 'None' as const },
          children: [],
        },
        nonRootSubintents: [],
      });

      const compiled = yield* compileTransaction({
        intent,
        signatures: [],
      });

      expect(compiled).toBeInstanceOf(Uint8Array);
      expect(compiled.length).toBeGreaterThan(0);
    }),
  );
});
