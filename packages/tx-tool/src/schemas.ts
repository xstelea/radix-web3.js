import {
  Base64String,
  Epoch,
  FungibleResourceAddress,
  HexString,
  NetworkId,
  Nonce,
  TransactionManifestString,
  TransactionMessageString,
} from '@radix-effects/shared';
import {
  Convert,
  PrivateKey,
  PublicKey,
  SignatureWithPublicKey,
} from '@steleaio/radix-engine-toolkit';
import { Effect, Option, Schema } from 'effect';

export const Base64FromHexSchema = Schema.asSchema(
  Schema.transformOrFail(HexString, Base64String, {
    decode: (hex) =>
      Effect.succeed(
        Base64String.make(Buffer.from(hex, 'hex').toString('base64')),
      ),
    encode: (base64) =>
      Effect.succeed(
        HexString.make(Buffer.from(base64, 'base64').toString('hex')),
      ),
  }),
);

export const HexFromBase64Schema = Schema.asSchema(
  Schema.transformOrFail(Base64String, HexString, {
    decode: (base64) =>
      Effect.succeed(
        HexString.make(Buffer.from(base64, 'base64').toString('hex')),
      ),
    encode: (hex) =>
      Effect.succeed(
        Base64String.make(Buffer.from(hex, 'hex').toString('base64')),
      ),
  }),
);

export const Ed25519PublicKeySchema = Schema.asSchema(
  Schema.transformOrFail(HexString, Schema.instanceOf(PublicKey.Ed25519), {
    decode: (hex) => Effect.succeed(new PublicKey.Ed25519(hex)),
    encode: (publicKey) => Effect.succeed(HexString.make(publicKey.hex())),
  }),
);
export type Ed25519PublicKey = typeof Ed25519PublicKeySchema.Type;

export const Ed25519PrivateKeySchema = Schema.asSchema(
  Schema.transformOrFail(HexString, Schema.instanceOf(PrivateKey.Ed25519), {
    decode: (hex) => Effect.succeed(new PrivateKey.Ed25519(hex)),
    encode: (publicKey) =>
      Effect.succeed(
        HexString.make(Convert.Uint8Array.toHexString(publicKey.bytes)),
      ),
  }),
);

export type Ed25519PrivateKey = typeof Ed25519PrivateKeySchema.Type;

export const ManifestSchema = Schema.asSchema(
  Schema.transformOrFail(
    TransactionManifestString,
    Schema.Struct({
      instructions: Schema.Struct({
        kind: Schema.Literal('String'),
        value: TransactionManifestString,
      }),
      blobs: Schema.mutable(Schema.Array(Schema.Uint8Array)),
    }),
    {
      decode: (value) =>
        Effect.succeed({
          instructions: {
            kind: 'String' as const,
            value,
          },
          blobs: [],
        }),
      encode: (input) =>
        Effect.succeed(
          TransactionManifestString.make(input.instructions.value),
        ),
    },
  ),
);

export type Manifest = typeof ManifestSchema.Type;
export type ManifestEncoded = TransactionManifestString;

const PlainTextMessageSchema = Schema.Struct({
  kind: Schema.Literal('PlainText'),
  value: Schema.Struct({
    message: Schema.Struct({
      kind: Schema.Literal('String'),
      value: TransactionMessageString,
    }),
    mimeType: Schema.Literal('text/plain'),
  }),
});

const EmptyMessageSchema = Schema.Struct({ kind: Schema.Literal('None') });

export const TransactionMessageSchema = Schema.asSchema(
  Schema.transformOrFail(
    Schema.OptionFromUndefinedOr(TransactionMessageString),
    Schema.Union(PlainTextMessageSchema, EmptyMessageSchema),
    {
      decode: (value) =>
        Option.match(value, {
          onNone: () => Effect.succeed({ kind: 'None' as const }),
          onSome: (value) =>
            Effect.succeed({
              kind: 'PlainText' as const,
              value: {
                message: { kind: 'String' as const, value },
                mimeType: 'text/plain' as const,
              },
            }),
        }),
      encode: (input) =>
        Effect.succeed(
          input.kind === 'None'
            ? Option.none()
            : Option.some(
                TransactionMessageString.make(input.value.message.value),
              ),
        ),
    },
  ),
);

export type TransactionMessage = typeof TransactionMessageSchema.Type;

export const TransactionHeaderSchema = Schema.Struct({
  networkId: NetworkId,
  startEpochInclusive: Epoch,
  endEpochExclusive: Epoch,
  notaryPublicKey: Ed25519PublicKeySchema,
  nonce: Nonce,
  notaryIsSignatory: Schema.Boolean,
  tipPercentage: Schema.Number,
});

export type TransactionHeader = typeof TransactionHeaderSchema.Type;

export const TransactionHeaderV2Schema = Schema.Struct({
  notaryPublicKey: Ed25519PublicKeySchema,
  notaryIsSignatory: Schema.Boolean,
  tipBasisPoints: Schema.Number,
});

export type TransactionHeaderV2 = typeof TransactionHeaderV2Schema.Type;

const TransactionMessageContentV2Schema = Schema.Union(
  Schema.Struct({
    kind: Schema.Literal('String'),
    value: TransactionMessageString,
  }),
  Schema.Struct({
    kind: Schema.Literal('Bytes'),
    value: Schema.Uint8Array,
  }),
);

const PlainTextMessageV2Schema = Schema.Struct({
  kind: Schema.Literal('PlainText'),
  value: Schema.Struct({
    mimeType: Schema.String,
    message: TransactionMessageContentV2Schema,
  }),
});

const DecryptorsByCurveV2Schema = Schema.Union(
  Schema.Struct({
    kind: Schema.Literal('Ed25519'),
    value: Schema.Struct({
      dhEphemeralPublicKey: Schema.Uint8Array,
      decryptors: Schema.Record({
        key: Schema.String,
        value: Schema.String,
      }),
    }),
  }),
  Schema.Struct({
    kind: Schema.Literal('Secp256k1'),
    value: Schema.Struct({
      dhEphemeralPublicKey: Schema.Uint8Array,
      decryptors: Schema.Record({
        key: Schema.String,
        value: Schema.String,
      }),
    }),
  }),
);

const EncryptedMessageV2Schema = Schema.Struct({
  kind: Schema.Literal('Encrypted'),
  value: Schema.Struct({
    encrypted: Schema.Uint8Array,
    decryptorsByCurve: Schema.Struct({
      Ed25519: DecryptorsByCurveV2Schema,
      Secp256k1: DecryptorsByCurveV2Schema,
    }),
  }),
});

const EmptyMessageV2Schema = Schema.Struct({ kind: Schema.Literal('None') });

export const TransactionMessageV2Schema = Schema.Union(
  EmptyMessageV2Schema,
  PlainTextMessageV2Schema,
  EncryptedMessageV2Schema,
);
export type TransactionMessageV2 = typeof TransactionMessageV2Schema.Type;

export const IntentHeaderV2Schema = Schema.Struct({
  networkId: NetworkId,
  startEpochInclusive: Epoch,
  endEpochExclusive: Epoch,
  minProposerTimestampInclusive: Schema.optional(Schema.Number),
  maxProposerTimestampExclusive: Schema.optional(Schema.Number),
  intentDiscriminator: Schema.Number,
});
export type IntentHeaderV2 = typeof IntentHeaderV2Schema.Type;

export const IntentCoreV2Schema = Schema.Struct({
  header: IntentHeaderV2Schema,
  instructions: TransactionManifestString,
  blobs: Schema.mutable(Schema.Array(Schema.Uint8Array)),
  message: TransactionMessageV2Schema,
  children: Schema.mutable(Schema.Array(Schema.Uint8Array)),
});
export type IntentCoreV2 = typeof IntentCoreV2Schema.Type;

export const SubintentV2Schema = Schema.Struct({
  intentCore: IntentCoreV2Schema,
});
export type SubintentV2 = typeof SubintentV2Schema.Type;

export const TransactionIntentSchema = Schema.Struct({
  header: TransactionHeaderSchema,
  message: TransactionMessageSchema,
  manifest: ManifestSchema,
});
export type TransactionIntent = typeof TransactionIntentSchema.Type;
export type TransactionIntentEncoded = typeof TransactionIntentSchema.Encoded;

export const TransactionIntentV2Schema = Schema.Struct({
  transactionHeader: TransactionHeaderV2Schema,
  rootIntentCore: IntentCoreV2Schema,
  nonRootSubintents: Schema.mutable(Schema.Array(SubintentV2Schema)),
});
export type TransactionIntentV2 = typeof TransactionIntentV2Schema.Type;
export type TransactionIntentV2Encoded =
  typeof TransactionIntentV2Schema.Encoded;

export const Ed25519SignatureWithPublicKeySchema = Schema.asSchema(
  Schema.transformOrFail(
    Schema.Struct({
      signature: HexString,
      signerPublicKey: HexString,
      curve: Schema.Literal('Ed25519'),
    }),
    Schema.instanceOf(SignatureWithPublicKey.Ed25519),
    {
      strict: false,
      decode: (value) =>
        Effect.succeed(
          new SignatureWithPublicKey.Ed25519(
            value.signature,
            value.signerPublicKey,
          ),
        ),
      encode: (input) =>
        Effect.succeed({
          signature: HexString.make(
            Convert.Uint8Array.toHexString(input.signature),
          ),
          signerPublicKey: HexString.make(
            Convert.Uint8Array.toHexString(input.publicKey),
          ),
        }),
    },
  ),
);

export type Ed25519SignatureWithPublicKey =
  typeof Ed25519SignatureWithPublicKeySchema.Type;

export type Ed25519SignatureWithPublicKeyEncoded =
  typeof Ed25519SignatureWithPublicKeySchema.Encoded;

export const BadgeDecodedSchema = Schema.Struct({
  type: Schema.Literal('fungibleResource'),
  resourceAddress: FungibleResourceAddress,
});

export const BadgeSchema = Schema.transformOrFail(
  Schema.Struct({
    type: Schema.String,
    resourceAddress: Schema.String,
  }),
  BadgeDecodedSchema,
  {
    strict: false,
    decode: (value) =>
      Effect.succeed(
        Schema.Struct({
          type: Schema.Literal('fungibleResource'),
          resourceAddress: FungibleResourceAddress,
        }).make({
          type: 'fungibleResource',
          resourceAddress: FungibleResourceAddress.make(value.resourceAddress),
        }),
      ),
    encode: (value) => Effect.succeed(value),
  },
);

export type Badge = typeof BadgeSchema.Type;
