import { describe, expect, layer } from "@effect/vitest";
import { GatewayApiClient, PreviewTransactionV2 } from "@radix-effects/gateway";
import {
  RadixEngineToolkit,
  TransactionV2Builder,
} from "@steleaio/radix-engine-toolkit";
import {
  ConfigProvider,
  Effect,
  Layer,
  Logger,
  Option,
  Redacted,
} from "effect";
import {
  AccountAddress,
  Epoch,
  HexString,
  NetworkId,
  TransactionManifestString,
} from "@radix-effects/shared";
import { CompileTransaction } from "./compileTransaction";
import { CreateTransactionIntent } from "./createTransactionIntent";
import { CreateTransactionIntentV2 } from "./createTransactionIntentV2";
import { IntentHashService } from "./intentHash";
import { faucet } from "./manifests/faucet";
import { SubintentV2Schema, TransactionIntentV2Schema } from "./schemas";
import { Signer } from "./signer/signer";
import { StaticallyAnalyzeManifestV2 } from "./staticallyAnalyzeManifestV2";
import { SubmitTransaction } from "./submitTransaction";
import { createAccount } from "./test-helpers/createAccount";
import { TransactionHeader } from "./transactionHeader";
import { TransactionHeaderV2 } from "./transactionHeaderV2";
import { TransactionStatus } from "./transactionStatus";

const signerLayer = Signer.makePrivateKeySigner(
  Redacted.make(
    HexString.make(
      "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    ),
  ),
);

const testLayer = Layer.mergeAll(
  CreateTransactionIntent.Default,
  CreateTransactionIntentV2.Default,
  CompileTransaction.Default,
  StaticallyAnalyzeManifestV2.Default,
  PreviewTransactionV2.Default,
  SubmitTransaction.Default,
  TransactionHeader.Default,
  TransactionHeaderV2.Default,
  TransactionStatus.Default,
  IntentHashService.Default,
).pipe(
  Layer.provide(signerLayer),
  Layer.provide(
    GatewayApiClient.Default.pipe(
      Layer.provide(
        ConfigProvider.layer(ConfigProvider.fromUnknown({ NETWORK_ID: 2 })),
      ),
    ),
  ),
);

describe("CreateTransactionIntent", () => {
  layer(testLayer, { excludeTestServices: true })((it) => {
    it.effect(
    "should create, compile, submit, and poll a transaction intent",
    () =>
      Effect.gen(function* () {
        yield* Effect.log("Creating transaction intent");
        const createTransactionIntent = yield* CreateTransactionIntent;
        const compileTransaction = yield* CompileTransaction;
        const submitTransaction = yield* SubmitTransaction;
        const pollTransactionStatus = yield* TransactionStatus;
        const intentHashService = yield* IntentHashService;
        const account = yield* createAccount({ networkId: 2 });
        // yield* Effect.log('Creating transaction intent');
        const intent = yield* createTransactionIntent({
          manifest: yield* faucet(AccountAddress.make(account.address)),
        });
        yield* Effect.log("Notary public key", {
          notaryPublicKey: intent.header.notaryPublicKey.hexString(),
        });
        const { id, hash } = yield* intentHashService.create(intent);
        const signatures = [
          {
            curve: "Ed25519" as const,
            signature: Buffer.from(account.sign(hash), "hex"),
            publicKey: Buffer.from(account.publicKeyHex, "hex"),
          },
        ];
        yield* Effect.log("Compiling transaction");
        const compiledTransaction = yield* compileTransaction({
          intent,
          signatures,
        });
        yield* Effect.log("Submitting transaction");
        yield* submitTransaction({
          compiledTransaction: compiledTransaction,
        });
        yield* Effect.log("Polling transaction status");
        const statusResult = yield* pollTransactionStatus.poll({
          id,
        });
        yield* Effect.log("Transaction status", {
          id,
          status: statusResult.intent_status,
        });
        expect(statusResult).toBeDefined();
      }).pipe(
        Effect.tapError(Effect.logError),
        Effect.provide(Logger.layer([Logger.consolePretty()])),
      ),
    {
      timeout: 300_000,
    },
    );

    it.effect(
    "should submit a v2 transaction when root and subintent headers differ",
    () =>
      Effect.gen(function* () {
        const createTransactionHeaderV2 = yield* TransactionHeaderV2;
        const compileTransaction = yield* CompileTransaction;
        const staticallyAnalyzeManifestV2 = yield* StaticallyAnalyzeManifestV2;
        const submitTransaction = yield* SubmitTransaction;
        const pollTransactionStatus = yield* TransactionStatus;
        const intentHashService = yield* IntentHashService;
        const networkId = NetworkId.make(2);
        const uniqueDiscriminator = Date.now();

        const knownAddresses = yield* Effect.tryPromise(() =>
          RadixEngineToolkit.Utils.knownAddresses(2),
        );
        const faucetAddress = knownAddresses.componentAddresses.faucet;

        const signerControlledAccount = yield* createAccount({
          networkId: 2,
          privateKey: Uint8Array.from(
            Buffer.from(
              "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
              "hex",
            ),
          ),
        });
        const recipientAccount = yield* createAccount({ networkId: 2 });
        const resourceAddress =
          "resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc";

        const signerAccountAddress = signerControlledAccount.address;
        const depositToAccountAddress = recipientAccount.address;

        const { transactionHeader, intentHeader } =
          yield* createTransactionHeaderV2({
            networkId,
            startEpochInclusive: Option.none(),
            endEpochExclusive: Option.none(),
          });
        const currentEpoch = intentHeader.startEpochInclusive;
        const currentTimestamp = Math.floor(Date.now() / 1000);

        const subintentInstructions = TransactionManifestString.make(`
          CALL_METHOD
            Address("${signerAccountAddress}")
            "withdraw"
            Address("${resourceAddress}")
            Decimal("1000")
          ;

          TAKE_ALL_FROM_WORKTOP
            Address("${resourceAddress}")
            Bucket("bucket1")
          ;

          CALL_METHOD
            Address("${depositToAccountAddress}")
            "try_deposit_or_abort"
            Bucket("bucket1")
            Enum<0u8>()
          ;

          YIELD_TO_PARENT;
        `);

        const childSubintent = SubintentV2Schema.make({
          intentCore: {
            header: {
              ...intentHeader,
              startEpochInclusive: Epoch.make(currentEpoch),
              endEpochExclusive: Epoch.make(currentEpoch + 2),
              minProposerTimestampInclusive: currentTimestamp - 300,
              maxProposerTimestampExclusive: currentTimestamp + 3_600,
              intentDiscriminator: uniqueDiscriminator,
            },
            instructions: subintentInstructions,
            blobs: [],
            message: { kind: "None" as const },
            children: [],
          },
        });

        const childSubintentHash = yield* Effect.tryPromise(() =>
          RadixEngineToolkit.SubintentV2.hash(childSubintent),
        );

        const manifest = TransactionManifestString.make(`
          USE_CHILD
            NamedIntent("intent1")
            Intent("${childSubintentHash.id}")
          ;

          CALL_METHOD
            Address("${faucetAddress}")
            "lock_fee"
            Decimal("10")
          ;

          CALL_METHOD
            Address("${faucetAddress}")
            "free"
          ;

          CALL_METHOD
            Address("${signerAccountAddress}")
            "try_deposit_batch_or_abort"
            Expression("ENTIRE_WORKTOP")
            Enum<0u8>()
          ;

          YIELD_TO_CHILD
            NamedIntent("intent1")
          ;
        `);

        const intent = TransactionIntentV2Schema.make({
          transactionHeader: {
            ...transactionHeader,
          },
          rootIntentCore: {
            header: {
              ...intentHeader,
              startEpochInclusive: Epoch.make(Math.max(1, currentEpoch - 1)),
              endEpochExclusive: Epoch.make(currentEpoch + 3),
              minProposerTimestampInclusive: currentTimestamp - 600,
              maxProposerTimestampExclusive: currentTimestamp + 7_200,
              intentDiscriminator: uniqueDiscriminator + 1,
            },
            instructions: manifest,
            blobs: [],
            message: { kind: "None" as const },
            children: [childSubintentHash.hash],
          },
          nonRootSubintents: [childSubintent],
        });

        const staticallyAnalyzeManifestV2Result =
          yield* staticallyAnalyzeManifestV2({ intent });
        yield* Effect.log("Statically analyze manifest v2 result", {
          staticallyAnalyzeManifestV2Result: JSON.stringify(staticallyAnalyzeManifestV2Result, null, 2),
        });

        const childSubintentHashHex = Buffer.from(
          childSubintentHash.hash,
        ).toString("hex");

        const childSubintentSignatures = [
          {
            curve: "Ed25519" as const,
            signature: Buffer.from(
              signerControlledAccount.sign(childSubintentHashHex),
              "hex",
            ),
            publicKey: Buffer.from(signerControlledAccount.publicKeyHex, "hex"),
          },
        ];

        const { id, hash } = yield* intentHashService.create(intent);

        yield* Effect.log("Intent hash", {
          id,
          intentHash: hash,
        });

        const signatures = [
          {
            curve: "Ed25519" as const,
            signature: Buffer.from(signerControlledAccount.sign(hash), "hex"),
            publicKey: Buffer.from(signerControlledAccount.publicKeyHex, "hex"),
          },
        ];

        const compiledTransaction = yield* compileTransaction({
          intent,
          signatures,
          subintentSignatures: [childSubintentSignatures],
        });

        const previewTransactionV2 = yield* PreviewTransactionV2;
        const builder = yield* Effect.tryPromise(() =>
          TransactionV2Builder.new(),
        );
        const previewTx = builder
          .header(intent.transactionHeader)
          .rootIntentCore(intent.rootIntentCore)
          .addSignedSubintent(intent.nonRootSubintents[0], [])
          .buildPreviewTransaction({
            rootSignerPublicKeys: [],
            nonRootSubintentSignerPublicKeys: [[]],
          });

        const compiledPreview = yield* Effect.tryPromise(() =>
          RadixEngineToolkit.PreviewTransactionV2.compile(previewTx),
        );
        const previewHex = Buffer.from(compiledPreview).toString("hex");
        const previewResult = yield* previewTransactionV2({
          payload: {
            preview_transaction: {
              type: "Compiled",
              preview_transaction_hex: previewHex,
            },
            flags: {
              assume_all_signature_proofs: true,
              skip_epoch_check: true,
              use_free_credit: true,
            },
            opt_ins: {
              core_api_receipt: false,
            },
          },
        });
        yield* Effect.log("V2 preview result", previewResult.receipt?.status);

        yield* submitTransaction({
          compiledTransaction,
        });

        const statusResult = yield* pollTransactionStatus.poll({ id });

        expect(statusResult).toBeDefined();
        expect(statusResult.intent_status).toBe("CommittedSuccess");
      }).pipe(
        Effect.tapError(Effect.logError),
        Effect.provide(Logger.layer([Logger.consolePretty()])),
      ),
    {
      timeout: 300_000,
    },
    );
  });
});
