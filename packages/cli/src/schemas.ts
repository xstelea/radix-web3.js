import { Schema } from 'effect';

export const PLACEHOLDER_PUBLIC_KEY_HEX =
  '<replace-with-ed25519-public-key-hex>';
export const PLACEHOLDER_SIGNATURE_HEX = '<replace-with-ed25519-signature-hex>';

const HexString = Schema.String.pipe(Schema.pattern(/^[0-9a-fA-F]+$/));
const Ed25519PublicKeyHex = HexString.pipe(Schema.length(64));
const Ed25519SignatureHex = HexString.pipe(Schema.length(128));
const SubintentId = Schema.String.pipe(
  Schema.pattern(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/),
);

export const PublicKeySchema = Schema.Struct({
  curve: Schema.Literal('Ed25519'),
  hex: Ed25519PublicKeyHex,
});

const PublicKeyOrPlaceholderSchema = Schema.Struct({
  curve: Schema.Literal('Ed25519'),
  hex: Schema.Union(
    Ed25519PublicKeyHex,
    Schema.Literal(PLACEHOLDER_PUBLIC_KEY_HEX),
  ),
});

const SignatureValueSchema = Schema.Struct({
  curve: Schema.Literal('Ed25519'),
  hex: Ed25519SignatureHex,
});

const SignatureValueOrPlaceholderSchema = Schema.Struct({
  curve: Schema.Literal('Ed25519'),
  hex: Schema.Union(
    Ed25519SignatureHex,
    Schema.Literal(PLACEHOLDER_SIGNATURE_HEX),
  ),
});

export const SigningScopeSchema = Schema.Union(
  Schema.Struct({ kind: Schema.Literal('rootIntent') }),
  Schema.Struct({
    kind: Schema.Literal('subintent'),
    subintentId: SubintentId,
  }),
  Schema.Struct({ kind: Schema.Literal('notarySignatory') }),
  Schema.Struct({ kind: Schema.Literal('notary') }),
);

const HashSchema = Schema.Struct({
  id: Schema.NullOr(Schema.String),
  hex: HexString,
});

export const SigningRequestSchema = Schema.Struct({
  type: Schema.Literal('signingRequest'),
  version: Schema.Literal(1),
  transactionId: Schema.NonEmptyString,
  scope: SigningScopeSchema,
  account: Schema.NullOr(Schema.NonEmptyString),
  hash: HashSchema,
  signingRequestPath: Schema.optional(Schema.String),
});

export const SignatureTemplateSchema = Schema.Struct({
  type: Schema.Literal('signatureTemplate'),
  version: Schema.Literal(1),
  transactionId: Schema.NonEmptyString,
  scope: SigningScopeSchema,
  account: Schema.NullOr(Schema.NonEmptyString),
  hash: HashSchema,
  signingRequestPath: Schema.optional(Schema.String),
  publicKey: PublicKeyOrPlaceholderSchema,
  signature: SignatureValueOrPlaceholderSchema,
});

export const SignatureEntrySchema = Schema.Struct({
  scope: SigningScopeSchema,
  account: Schema.NullOr(Schema.NonEmptyString),
  hash: HashSchema,
  signingRequestPath: Schema.optional(Schema.String),
  publicKey: PublicKeySchema.pipe(
    Schema.filter((value) => value.hex !== PLACEHOLDER_PUBLIC_KEY_HEX, {
      message: () =>
        'Replace the public key placeholder before importing signatures',
    }),
  ),
  signature: SignatureValueSchema.pipe(
    Schema.filter((value) => value.hex !== PLACEHOLDER_SIGNATURE_HEX, {
      message: () =>
        'Replace the signature placeholder before importing signatures',
    }),
  ),
});

export const SignatureFileSchema = Schema.Struct({
  type: Schema.Literal('signatureFile'),
  version: Schema.Literal(1),
  transactionId: Schema.NonEmptyString,
  signatures: Schema.Array(SignatureEntrySchema),
});

export const BatchSignatureFileSchema = Schema.Struct({
  type: Schema.Literal('batchSignatureFile'),
  version: Schema.Literal(1),
  signatures: Schema.NonEmptyArray(SignatureFileSchema),
});

export const SubintentsFileSchema = Schema.Struct({
  type: Schema.Literal('subintents'),
  version: Schema.Literal(1),
  subintents: Schema.Record({
    key: Schema.String,
    value: Schema.Struct({
      manifest: Schema.NonEmptyString,
    }),
  }).pipe(
    Schema.filter(
      (subintents) =>
        Object.keys(subintents).every((key) =>
          /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(key),
        ),
      { message: () => 'Subintent IDs must be conservative identifiers' },
    ),
  ),
});

export const NotaryFileSchema = Schema.Struct({
  type: Schema.Literal('notary'),
  version: Schema.Literal(1),
  publicKey: PublicKeySchema,
  notaryIsSignatory: Schema.optional(Schema.Boolean),
});

export const ArtifactStatusSchema = Schema.Union(
  Schema.Literal('prepared'),
  Schema.Literal('notarized'),
  Schema.Literal('submitted'),
);

export const AuthorizationAnalysisSchema = Schema.Struct({
  rootIntent: Schema.Array(Schema.String),
  subintents: Schema.Record({
    key: Schema.String,
    value: Schema.Array(Schema.String),
  }),
});

export const PreparedTransactionSchema = Schema.Struct({
  type: Schema.Literal('preparedTransaction'),
  version: Schema.Literal(1),
  transactionId: Schema.NonEmptyString,
  network: Schema.Union(Schema.Literal('mainnet'), Schema.Literal('stokenet')),
  intentHash: HashSchema,
  manifestSourceFile: Schema.String,
  transactionIntentPath: Schema.String,
  staticAnalysisPath: Schema.String,
  signingRequests: Schema.Array(Schema.String),
  signatureTemplates: Schema.Array(Schema.String),
  subintentOrder: Schema.Array(Schema.String),
  authorizationAnalysis: AuthorizationAnalysisSchema,
  notaryPublicKey: Schema.optional(PublicKeySchema),
  notaryIsSignatory: Schema.optional(Schema.Boolean),
});

export const NetworkTransactionStatusSchema = Schema.Struct({
  transactionId: Schema.NonEmptyString,
  status: Schema.String,
  statusDescription: Schema.String,
  errorMessage: Schema.NullOr(Schema.String),
  checkedAt: Schema.String,
});

export const SubmitResultSchema = Schema.Struct({
  type: Schema.Literal('submitResult'),
  version: Schema.Literal(1),
  transactionId: Schema.NonEmptyString,
  networkStatus: NetworkTransactionStatusSchema,
  attempts: Schema.Array(
    Schema.Struct({
      checkedAt: Schema.String,
      status: Schema.String,
      statusDescription: Schema.String,
      errorMessage: Schema.NullOr(Schema.String),
    }),
  ),
});

export type SigningScope = typeof SigningScopeSchema.Type;
export type SigningRequest = typeof SigningRequestSchema.Type;
export type SignatureTemplate = typeof SignatureTemplateSchema.Type;
export type SignatureEntry = typeof SignatureEntrySchema.Type;
export type SignatureFile = typeof SignatureFileSchema.Type;
export type SubintentsFile = typeof SubintentsFileSchema.Type;
export type NotaryFile = typeof NotaryFileSchema.Type;
export type ArtifactStatus = typeof ArtifactStatusSchema.Type;
export type AuthorizationAnalysis = typeof AuthorizationAnalysisSchema.Type;
export type PreparedTransaction = typeof PreparedTransactionSchema.Type;
export type NetworkTransactionStatus =
  typeof NetworkTransactionStatusSchema.Type;
export type SubmitResult = typeof SubmitResultSchema.Type;
