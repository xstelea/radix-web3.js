import { z } from 'zod';

export const Account = z.object({
  address: z.string(),
  label: z.string(),
  appearanceId: z.number(),
});
export type Account = z.infer<typeof Account>;

export const Proof = z.object({
  publicKey: z.string(),
  signature: z.string(),
  curve: z.union([z.literal('curve25519'), z.literal('secp256k1')]),
});
export type Proof = z.infer<typeof Proof>;

export const AccountProof = z.object({
  accountAddress: z.string(),
  proof: Proof,
});
export type AccountProof = z.infer<typeof AccountProof>;

export const PersonaProof = z.object({
  identityAddress: z.string(),
  proof: Proof,
});
export type PersonaProof = z.infer<typeof PersonaProof>;

export const ProofOfOwnershipRequestItem = z.object({
  challenge: z.string(),
  identityAddress: z.string().optional(),
  accountAddresses: z.array(z.string()).optional(),
});
export type ProofOfOwnershipRequestItem = z.infer<
  typeof ProofOfOwnershipRequestItem
>;

export const ProofOfOwnershipResponseItem = z.object({
  challenge: z.string(),
  proofs: z.array(z.union([AccountProof, PersonaProof])),
});

export const Persona = z.object({
  identityAddress: z.string(),
  label: z.string(),
});
export type Persona = z.infer<typeof Persona>;

export const personaDataFullNameVariant = {
  western: 'western',
  eastern: 'eastern',
} as const;

export const PersonaDataNameVariant = z.union([
  z.literal(personaDataFullNameVariant.eastern),
  z.literal(personaDataFullNameVariant.western),
]);
export type PersonaDataNameVariant = z.infer<typeof PersonaDataNameVariant>;

export const PersonaDataName = z.object({
  variant: PersonaDataNameVariant,
  familyName: z.string(),
  nickname: z.string(),
  givenNames: z.string(),
});
export type PersonaDataName = z.infer<typeof PersonaDataName>;

export const NumberOfValues = z.object({
  quantifier: z.union([z.literal('exactly'), z.literal('atLeast')]),
  quantity: z.number().min(0, 'The number must be at least 0.'),
});
export type NumberOfValues = z.infer<typeof NumberOfValues>;

export const AccountsRequestItem = z.object({
  challenge: z.string().optional(),
  numberOfAccounts: NumberOfValues,
});
export type AccountsRequestItem = z.infer<typeof AccountsRequestItem>;

export const AccountsRequestResponseItem = z
  .object({
    accounts: z.array(Account),
    challenge: z.string().optional(),
    proofs: z.array(AccountProof).optional(),
  })
  .refine((data) => {
    if (data.challenge || data?.proofs) {
      return !!(data.challenge && data?.proofs?.length);
    }
    return true;
  }, 'missing challenge or proofs');
export type AccountsRequestResponseItem = z.infer<
  typeof AccountsRequestResponseItem
>;

export const PersonaDataRequestItem = z.object({
  isRequestingName: z.boolean().optional(),
  numberOfRequestedEmailAddresses: z.number().min(0).optional(),
  numberOfRequestedPhoneNumbers: z.number().min(0).optional(),
});
export type PersonaDataRequestItem = z.infer<typeof PersonaDataRequestItem>;

export const PersonaDataRequestResponseItem = z.object({
  name: z
    .object({
      variant: PersonaDataNameVariant,
      familyName: z.string(),
      nickname: z.string(),
      givenNames: z.string(),
    })
    .optional(),
  emailAddresses: z.array(z.string()).optional(),
  phoneNumbers: z.array(z.string()).optional(),
});
export type PersonaDataRequestResponseItem = z.infer<
  typeof PersonaDataRequestResponseItem
>;

export const ResetRequestItem = z.object({
  accounts: z.boolean(),
  personaData: z.boolean(),
});
export type ResetRequestItem = z.infer<typeof ResetRequestItem>;

export const LoginRequestResponseItem = z
  .object({
    persona: Persona,
    challenge: z.string().optional(),
    proof: Proof.optional(),
  })
  .refine((data) => {
    if (data.challenge || data.proof) {
      return !!(data.challenge && data.proof);
    }
    return true;
  }, 'missing challenge or proof');
export type LoginRequestResponseItem = z.infer<typeof LoginRequestResponseItem>;

export const WalletUnauthorizedRequestItems = z.object({
  discriminator: z.literal('unauthorizedRequest'),
  oneTimeAccounts: AccountsRequestItem.optional(),
  oneTimePersonaData: PersonaDataRequestItem.optional(),
});
export type WalletUnauthorizedRequestItems = z.infer<
  typeof WalletUnauthorizedRequestItems
>;

export const AuthUsePersonaRequestItem = z.object({
  discriminator: z.literal('usePersona'),
  identityAddress: z.string(),
});
export type AuthUsePersonaRequestItem = z.infer<
  typeof AuthUsePersonaRequestItem
>;

export const AuthLoginWithoutChallengeRequestItem = z.object({
  discriminator: z.literal('loginWithoutChallenge'),
});
export type AuthLoginWithoutChallengeRequestItem = z.infer<
  typeof AuthLoginWithoutChallengeRequestItem
>;

export const AuthLoginWithChallengeRequestItem = z.object({
  discriminator: z.literal('loginWithChallenge'),
  challenge: z.string(),
});
export type AuthLoginWithChallengeRequestItem = z.infer<
  typeof AuthLoginWithChallengeRequestItem
>;

export const AuthLoginRequestItem = z.union([
  AuthLoginWithoutChallengeRequestItem,
  AuthLoginWithChallengeRequestItem,
]);
export const AuthRequestItem = z.union([
  AuthUsePersonaRequestItem,
  AuthLoginRequestItem,
]);

export const WalletAuthorizedRequestItems = z.object({
  discriminator: z.literal('authorizedRequest'),
  auth: AuthRequestItem,
  reset: ResetRequestItem.optional(),
  proofOfOwnership: ProofOfOwnershipRequestItem.optional(),
  oneTimeAccounts: AccountsRequestItem.optional(),
  ongoingAccounts: AccountsRequestItem.optional(),
  oneTimePersonaData: PersonaDataRequestItem.optional(),
  ongoingPersonaData: PersonaDataRequestItem.optional(),
});
export type WalletAuthorizedRequestItems = z.infer<
  typeof WalletAuthorizedRequestItems
>;

export const WalletRequestItems = z.union([
  WalletUnauthorizedRequestItems,
  WalletAuthorizedRequestItems,
]);
export type WalletRequestItems = z.infer<typeof WalletRequestItems>;

export const SendTransactionItem = z.object({
  transactionManifest: z.string(),
  version: z.number(),
  blobs: z.array(z.string()).optional(),
  message: z.string().optional(),
});
export type SendTransactionItem = z.infer<typeof SendTransactionItem>;

export const WalletTransactionItems = z.object({
  discriminator: z.literal('transaction'),
  send: SendTransactionItem,
});
export type WalletTransactionItems = z.infer<typeof WalletTransactionItems>;

export const SendTransactionResponseItem = z.object({
  transactionIntentHash: z.string(),
});
export type SendTransactionResponseItem = z.infer<
  typeof SendTransactionResponseItem
>;

export const WalletTransactionResponseItems = z.object({
  discriminator: z.literal('transaction'),
  send: SendTransactionResponseItem,
});

export const CancelRequest = z.object({
  discriminator: z.literal('cancelRequest'),
});
export type CancelRequest = z.infer<typeof CancelRequest>;

export const ExpireAtTime = z.object({
  discriminator: z.literal('expireAtTime'),
  unixTimestampSeconds: z.number(),
});
export type ExpireAtTime = z.infer<typeof ExpireAtTime>;

export const ExpireAfterDelay = z.object({
  discriminator: z.literal('expireAfterDelay'),
  expireAfterSeconds: z.number(),
});
export type ExpireAfterDelay = z.infer<typeof ExpireAfterDelay>;

export const SubintentRequestItem = z.object({
  discriminator: z.literal('subintent'),
  version: z.number(),
  manifestVersion: z.number(),
  subintentManifest: z.string(),
  blobs: z.array(z.string()).optional(),
  message: z.string().optional(),
  expiration: z.union([ExpireAtTime, ExpireAfterDelay]),
});
export type SubintentRequestItem = z.infer<typeof SubintentRequestItem>;

export const SubintentResponseItem = z.object({
  expirationTimestamp: z.number(),
  subintentHash: z.string(),
  signedPartialTransaction: z.string(),
});
export type SubintentResponseItem = z.infer<typeof SubintentResponseItem>;

export const WalletPreAuthorizationItems = z.object({
  discriminator: z.literal('preAuthorizationRequest'),
  request: SubintentRequestItem.optional(),
});
export type WalletPreAuthorizationItems = z.infer<
  typeof WalletPreAuthorizationItems
>;

export const WalletInteractionItems = z.union([
  WalletRequestItems,
  WalletTransactionItems,
  CancelRequest,
  WalletPreAuthorizationItems,
]);
export type WalletInteractionItems = z.infer<typeof WalletInteractionItems>;

export const Metadata = z.object({
  version: z.literal(2),
  networkId: z.number(),
  dAppDefinitionAddress: z.string(),
  origin: z.string(),
});
export type Metadata = z.infer<typeof Metadata>;

export const WalletInteraction = z.object({
  interactionId: z.string(),
  metadata: Metadata,
  items: WalletInteractionItems,
});
export type WalletInteraction = z.infer<typeof WalletInteraction>;

export const WalletUnauthorizedRequestResponseItems = z.object({
  discriminator: z.literal('unauthorizedRequest'),
  oneTimeAccounts: AccountsRequestResponseItem.optional(),
  oneTimePersonaData: PersonaDataRequestResponseItem.optional(),
});

export const AuthLoginWithoutChallengeRequestResponseItem = z.object({
  discriminator: z.literal('loginWithoutChallenge'),
  persona: Persona,
});
export type AuthLoginWithoutChallengeRequestResponseItem = z.infer<
  typeof AuthLoginWithoutChallengeRequestResponseItem
>;

export const AuthLoginWithChallengeRequestResponseItem = z.object({
  discriminator: z.literal('loginWithChallenge'),
  persona: Persona,
  challenge: z.string(),
  proof: Proof,
});
export type AuthLoginWithChallengeRequestResponseItem = z.infer<
  typeof AuthLoginWithChallengeRequestResponseItem
>;

export const WalletPreAuthorizationResponseItems = z.object({
  discriminator: z.literal('preAuthorizationResponse'),
  response: SubintentResponseItem.optional(),
});

export const AuthLoginRequestResponseItem = z.union([
  AuthLoginWithoutChallengeRequestResponseItem,
  AuthLoginWithChallengeRequestResponseItem,
]);

export const AuthUsePersonaRequestResponseItem = z.object({
  discriminator: z.literal('usePersona'),
  persona: Persona,
});

export const AuthRequestResponseItem = z.union([
  AuthUsePersonaRequestResponseItem,
  AuthLoginRequestResponseItem,
]);

export const WalletAuthorizedRequestResponseItems = z.object({
  discriminator: z.literal('authorizedRequest'),
  auth: AuthRequestResponseItem,
  proofOfOwnership: ProofOfOwnershipResponseItem.optional(),
  oneTimeAccounts: AccountsRequestResponseItem.optional(),
  ongoingAccounts: AccountsRequestResponseItem.optional(),
  oneTimePersonaData: PersonaDataRequestResponseItem.optional(),
  ongoingPersonaData: PersonaDataRequestResponseItem.optional(),
});

export const WalletRequestResponseItems = z.union([
  WalletUnauthorizedRequestResponseItems,
  WalletAuthorizedRequestResponseItems,
]);

export const WalletInteractionResponseItems = z.union([
  WalletRequestResponseItems,
  WalletTransactionResponseItems,
  WalletPreAuthorizationResponseItems,
]);

export const WalletInteractionSuccessResponse = z.object({
  discriminator: z.literal('success'),
  interactionId: z.string(),
  items: WalletInteractionResponseItems,
});

export const WalletInteractionFailureResponse = z.object({
  discriminator: z.literal('failure'),
  interactionId: z.string(),
  error: z.string(),
  message: z.string().optional(),
});

export const WalletInteractionResponse = z.union([
  WalletInteractionSuccessResponse,
  WalletInteractionFailureResponse,
]);
export type WalletInteractionResponse = z.infer<
  typeof WalletInteractionResponse
>;
