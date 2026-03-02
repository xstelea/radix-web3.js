import { it } from "@effect/vitest";
import { GatewayApiClient } from "@radix-effects/gateway";
import { RadixEngineToolkit } from "@steleaio/radix-engine-toolkit";
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
  HexString,
  NetworkId,
  TransactionManifestString,
} from "@radix-effects/shared";
import { CompileTransaction } from "./compileTransaction";
import { CreateTransactionIntent } from "./createTransactionIntent";
import { CreateTransactionIntentV2 } from "./createTransactionIntentV2";
import { IntentHashService } from "./intentHash";
import { faucet } from "./manifests/faucet";
import { PreviewTransaction } from "./previewTransaction";
import { SubintentV2Schema, TransactionIntentV2Schema } from "./schemas";
import { Signer } from "./signer/signer";
import { StaticallyAnalyzeManifestV2 } from "./staticallyAnalyzeManifestV2";
import { SubmitTransaction } from "./submitTransaction";
import { createAccount } from "./test-helpers/createAccount";
import { TransactionHeader } from "./transactionHeader";
import { TransactionHeaderV2 } from "./transactionHeaderV2";
import { TransactionStatus } from "./transactionStatus";
import { describe, expect } from "vitest";

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
  PreviewTransaction.Default,
  StaticallyAnalyzeManifestV2.Default,
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
        Layer.setConfigProvider(ConfigProvider.fromJson({ NETWORK_ID: 2 })),
      ),
    ),
  ),
);

describe("CreateTransactionIntent", () => {
  it.live(
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
        Effect.provide(Logger.pretty),
        Effect.provide(testLayer),
      ),
    {
      timeout: 300_000,
    },
  );

  it.live(
    "should create, compile, submit, and poll a v2 transaction intent",
    () =>
      Effect.gen(function* () {
        const createTransactionHeaderV2 = yield* TransactionHeaderV2;
        const compileTransaction = yield* CompileTransaction;
        const createTransactionIntent = yield* CreateTransactionIntent;
        const previewTransaction = yield* PreviewTransaction;
        const staticallyAnalyzeManifestV2 = yield* StaticallyAnalyzeManifestV2;
        const submitTransaction = yield* SubmitTransaction;
        const pollTransactionStatus = yield* TransactionStatus;
        const createTransactionHeader = yield* TransactionHeader;
        const intentHashService = yield* IntentHashService;
        const networkId = NetworkId.make(2);
        const uniqueDiscriminator = Date.now();
        const toGatewayKeyType = (curve: "Ed25519" | "Secp256k1") =>
          curve === "Ed25519" ? "EddsaEd25519" : "EcdsaSecp256k1";

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

        const lockFeeAccountAddress = signerControlledAccount.address;
        const withdrawFromAccountAddress = signerControlledAccount.address;
        const depositToAccountAddress = recipientAccount.address;

        const fundSignerAccountIntent = yield* createTransactionIntent({
          manifest: yield* faucet(signerControlledAccount.address),
        });

        const { id: fundSignerAccountId, hash: fundSignerAccountHash } =
          yield* intentHashService.create(fundSignerAccountIntent);

        const fundSignerAccountSignatures = [
          {
            curve: "Ed25519" as const,
            signature: Buffer.from(
              signerControlledAccount.sign(fundSignerAccountHash),
              "hex",
            ),
            publicKey: Buffer.from(signerControlledAccount.publicKeyHex, "hex"),
          },
        ];

        const fundSignerAccountCompiled = yield* compileTransaction({
          intent: fundSignerAccountIntent,
          signatures: fundSignerAccountSignatures,
        });

        yield* submitTransaction({
          compiledTransaction: fundSignerAccountCompiled,
        });

        yield* pollTransactionStatus.poll({ id: fundSignerAccountId });

        const { transactionHeader, intentHeader } =
          yield* createTransactionHeaderV2({
            networkId,
            startEpochInclusive: Option.none(),
            endEpochExclusive: Option.none(),
          });

        const subintentInstructions = TransactionManifestString.make(`
          CALL_METHOD
            Address("${withdrawFromAccountAddress}")
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
            Address("${lockFeeAccountAddress}")
            "lock_fee"
            Decimal("10")
          ;

          YIELD_TO_CHILD
            NamedIntent("intent1")
          ;
        `);

        const previewHeader = yield* createTransactionHeader({
          networkId,
          startEpochInclusive: Option.none(),
          endEpochExclusive: Option.none(),
        });

        const signerPublicKey = {
          curve: "Ed25519" as const,
          hex: () => signerControlledAccount.publicKeyHex,
        };

        const previewTransactionResult = yield* previewTransaction({
          payload: {
            manifest: fundSignerAccountIntent.manifest.instructions.value,
            blobs_hex: [],
            start_epoch_inclusive: previewHeader.startEpochInclusive,
            end_epoch_exclusive: previewHeader.endEpochExclusive,
            notary_public_key: {
              key_type: toGatewayKeyType(previewHeader.notaryPublicKey.curve),
              key_hex: previewHeader.notaryPublicKey.hex(),
            },
            notary_is_signatory: previewHeader.notaryIsSignatory,
            tip_percentage: previewHeader.tipPercentage,
            nonce: previewHeader.nonce,
            signer_public_keys: [
              {
                key_type: toGatewayKeyType(signerPublicKey.curve),
                key_hex: signerPublicKey.hex(),
              },
            ],
            flags: {
              assume_all_signature_proofs: true,
              skip_epoch_check: false,
              use_free_credit: false,
            },
          },
        });

        yield* Effect.log("Preview transaction result", {
          previewTransactionResult: JSON.stringify(previewTransactionResult, null, 2),
        });

        const intent = TransactionIntentV2Schema.make({
          transactionHeader: {
            ...transactionHeader,
          },
          rootIntentCore: {
            header: {
              ...intentHeader,
              intentDiscriminator: uniqueDiscriminator + 1,
            },
            instructions: manifest,
            blobs: [],
            message: { kind: "None" as const },
            children: [childSubintentHash.hash],
          },
          nonRootSubintents: [childSubintent],
        });



        const staticallyAnalyzeManifestV2Result = yield* staticallyAnalyzeManifestV2({ intent });
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

        yield* submitTransaction({
          compiledTransaction,
        });

        const statusResult = yield* pollTransactionStatus.poll({ id });

        expect(statusResult).toBeDefined();
      }).pipe(
        Effect.tapError(Effect.logError),
        Effect.provide(Logger.pretty),
        Effect.provide(testLayer),
      ),
    {
      timeout: 300_000,
    },
  );
});
