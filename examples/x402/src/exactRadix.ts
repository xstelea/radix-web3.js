import type { PaymentRequirements } from './paymentRequirements';

export type PaymentSubintentManifestInput = {
  requirements: PaymentRequirements;
  payerAccount: string;
};

export type PreviewRootManifestInput = {
  requirements: PaymentRequirements;
  feePayerAccount: string;
};

export const subintentHashPlaceholder = '<subintentHash>';

export const paymentSubintentManifest = ({
  payerAccount,
  requirements,
}: PaymentSubintentManifestInput): string => `VERIFY_PARENT
    Enum<AccessRule::Protected>(
        Enum<CompositeRequirement::BasicRequirement>(
            Enum<BasicRequirement::Require>(
                Enum<ResourceOrNonFungible::NonFungible>(
                    NonFungibleGlobalId("${requirements.extra.notaryBadge}")
                )
            )
        )
    )
;
ASSERT_WORKTOP_IS_EMPTY;
CALL_METHOD
    Address("${payerAccount}")
    "withdraw"
    Address("${requirements.asset}")
    Decimal("${requirements.amount}")
;
TAKE_ALL_FROM_WORKTOP
    Address("${requirements.asset}")
    Bucket("payment")
;
YIELD_TO_PARENT Bucket("payment");`;

export const previewRootManifest = ({
  feePayerAccount,
  requirements,
}: PreviewRootManifestInput): string => `USE_CHILD
    NamedIntent("payment")
    Intent("${subintentHashPlaceholder}")
;
CALL_METHOD
    Address("${feePayerAccount}")
    "lock_fee"
    Decimal("10")
;
YIELD_TO_CHILD NamedIntent("payment");
TAKE_ALL_FROM_WORKTOP
    Address("${requirements.asset}")
    Bucket("payment")
;
CALL_METHOD
    Address("${requirements.payTo}")
    "try_deposit_or_abort"
    Bucket("payment")
    None
;`;
