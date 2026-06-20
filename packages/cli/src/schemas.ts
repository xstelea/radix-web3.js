import { Schema } from 'effect';

export const PLACEHOLDER_PUBLIC_KEY_HEX =
  '<replace-with-ed25519-public-key-hex>';
export const PLACEHOLDER_SIGNATURE_HEX = '<replace-with-ed25519-signature-hex>';

export const NetworkSchema = Schema.Literals(['mainnet', 'stokenet']).pipe(
  Schema.brand('Network'),
);
export type Network = typeof NetworkSchema.Type;

export const ArtifactScopeSchema = Schema.Literals(['local', 'global']).pipe(
  Schema.brand('ArtifactScope'),
);
export type ArtifactScope = typeof ArtifactScopeSchema.Type;

export const OutputFormatSchema = Schema.Literals(['json', 'text']).pipe(
  Schema.brand('OutputFormat'),
);
export type OutputFormat = typeof OutputFormatSchema.Type;

export const HexStringSchema = Schema.String.check(
  Schema.isPattern(/^[0-9a-fA-F]+$/),
);
export const Ed25519PublicKeyHexSchema = HexStringSchema.pipe(
  Schema.check(Schema.isLengthBetween(64, 64)),
);
export const Ed25519SignatureHexSchema = HexStringSchema.pipe(
  Schema.check(Schema.isLengthBetween(128, 128)),
);
export const SubintentIdSchema = Schema.String.check(
  Schema.isPattern(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/),
);

export const PublicKeySchema = Schema.Struct({
  curve: Schema.Literal('Ed25519'),
  hex: Ed25519PublicKeyHexSchema,
});

const PublicKeyOrPlaceholderSchema = Schema.Struct({
  curve: Schema.Literal('Ed25519'),
  hex: Schema.Union([
    Ed25519PublicKeyHexSchema,
    Schema.Literal(PLACEHOLDER_PUBLIC_KEY_HEX),
  ]),
});

const SignatureValueSchema = Schema.Struct({
  curve: Schema.Literal('Ed25519'),
  hex: Ed25519SignatureHexSchema,
});

const SignatureValueOrPlaceholderSchema = Schema.Struct({
  curve: Schema.Literal('Ed25519'),
  hex: Schema.Union([
    Ed25519SignatureHexSchema,
    Schema.Literal(PLACEHOLDER_SIGNATURE_HEX),
  ]),
});

export const SigningScopeSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('rootIntent') }),
  Schema.Struct({
    kind: Schema.Literal('subintent'),
    subintentId: SubintentIdSchema,
  }),
  Schema.Struct({ kind: Schema.Literal('notarySignatory') }),
  Schema.Struct({ kind: Schema.Literal('notary') }),
]);

const HashSchema = Schema.Struct({
  id: Schema.NullOr(Schema.String),
  hex: HexStringSchema,
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
    Schema.check(
      Schema.makeFilter((value) => value.hex !== PLACEHOLDER_PUBLIC_KEY_HEX, {
        message:
          'Replace the public key placeholder before importing signatures',
      }),
    ),
  ),
  signature: SignatureValueSchema.pipe(
    Schema.check(
      Schema.makeFilter((value) => value.hex !== PLACEHOLDER_SIGNATURE_HEX, {
        message:
          'Replace the signature placeholder before importing signatures',
      }),
    ),
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
  subintents: Schema.Record(
    Schema.String,
    Schema.Struct({
      manifest: Schema.NonEmptyString,
    }),
  ).pipe(
    Schema.check(
      Schema.makeFilter(
        (subintents) =>
          Object.keys(subintents).every((key) =>
            /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(key),
          ),
        { message: 'Subintent IDs must be conservative identifiers' },
      ),
    ),
  ),
});

export const SubintentHeaderFileSchema = Schema.Struct({
  type: Schema.Literal('subintentHeader'),
  version: Schema.Literal(1),
  header: Schema.Struct({
    networkId: Schema.Number,
    startEpochInclusive: Schema.Number,
    endEpochExclusive: Schema.Number,
    intentDiscriminator: Schema.Number,
    minProposerTimestampInclusive: Schema.optional(Schema.Number),
    maxProposerTimestampExclusive: Schema.optional(Schema.Number),
  }),
  message: Schema.optional(Schema.String),
});

export const NotaryFileSchema = Schema.Struct({
  type: Schema.Literal('notary'),
  version: Schema.Literal(1),
  publicKey: PublicKeySchema,
  notaryIsSignatory: Schema.optional(Schema.Boolean),
});

export const ArtifactStatusSchema = Schema.Union([
  Schema.Literal('prepared'),
  Schema.Literal('notarized'),
  Schema.Literal('submitted'),
]);

export const AuthorizationAnalysisSchema = Schema.Struct({
  rootIntent: Schema.Array(Schema.String),
  subintents: Schema.Record(Schema.String, Schema.Array(Schema.String)),
});

export const PreparedTransactionSchema = Schema.Struct({
  type: Schema.Literal('preparedTransaction'),
  version: Schema.Literal(1),
  transactionId: Schema.NonEmptyString,
  network: NetworkSchema,
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

export const PreparedSubintentSchema = Schema.Struct({
  type: Schema.Literal('preparedSubintent'),
  version: Schema.Literal(1),
  subintentHash: HashSchema,
  networkId: Schema.Number,
  manifestSourceFile: Schema.String,
  headerSourceFile: Schema.String,
  subintentPath: Schema.String,
  subintentManifestPath: Schema.String,
  subintentHeaderPath: Schema.String,
  signingRequestPath: Schema.String,
  signatureTemplatePath: Schema.String,
  previewRootManifestPath: Schema.optional(Schema.String),
  previewResultPath: Schema.String,
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

export const AccountFungiblesResultSchema = Schema.Struct({
  type: Schema.Literal('commandResult'),
  command: Schema.Literal('account fungibles'),
  result: Schema.Unknown,
});

export const AccountNftsResultSchema = Schema.Struct({
  type: Schema.Literal('commandResult'),
  command: Schema.Literal('account nfts'),
  result: Schema.Unknown,
});

export const AccountShowResultSchema = Schema.Struct({
  type: Schema.Literal('commandResult'),
  command: Schema.Literal('account show'),
  result: Schema.Unknown,
});

export const TransactionHistoryResultSchema = Schema.Struct({
  type: Schema.Literal('commandResult'),
  command: Schema.Literal('tx history'),
  result: Schema.Unknown,
});

export const VirtualAccountDerivationSchema = Schema.Struct({
  network: NetworkSchema,
  derivation: Schema.Literal('virtualAccount'),
  publicKey: PublicKeySchema,
  accountAddress: Schema.String,
});

export type SigningScope = typeof SigningScopeSchema.Type;
export type SigningRequest = typeof SigningRequestSchema.Type;
export type SignatureTemplate = typeof SignatureTemplateSchema.Type;
export type SignatureEntry = typeof SignatureEntrySchema.Type;
export type SignatureFile = typeof SignatureFileSchema.Type;
export type SubintentsFile = typeof SubintentsFileSchema.Type;
export type SubintentHeaderFile = typeof SubintentHeaderFileSchema.Type;
export type NotaryFile = typeof NotaryFileSchema.Type;
export type ArtifactStatus = typeof ArtifactStatusSchema.Type;
export type AuthorizationAnalysis = typeof AuthorizationAnalysisSchema.Type;
export type PreparedTransaction = typeof PreparedTransactionSchema.Type;
export type PreparedSubintent = typeof PreparedSubintentSchema.Type;
export type NetworkTransactionStatus =
  typeof NetworkTransactionStatusSchema.Type;
export type SubmitResult = typeof SubmitResultSchema.Type;
export type AccountFungiblesResult = typeof AccountFungiblesResultSchema.Type;
export type AccountNftsResult = typeof AccountNftsResultSchema.Type;
export type AccountShowResult = typeof AccountShowResultSchema.Type;
export type TransactionHistoryResult =
  typeof TransactionHistoryResultSchema.Type;
export type VirtualAccountDerivation =
  typeof VirtualAccountDerivationSchema.Type;
