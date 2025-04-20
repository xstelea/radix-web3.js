export const createFungibleToken = (accountAddress: string) => `CALL_METHOD
    Address("${accountAddress}")
    "lock_fee"
    Decimal("10")
;

CREATE_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY
    Enum<0u8>()
    true
    0u8
    Decimal("100000")
    Tuple(
        Enum<1u8>(
            Tuple(
                Enum<1u8>(
                    Enum<1u8>()
                ),
                Enum<1u8>(
                    Enum<1u8>()
                )
            )
        ),
        Enum<1u8>(
            Tuple(
                Enum<1u8>(
                    Enum<1u8>()
                ),
                Enum<1u8>(
                    Enum<1u8>()
                )
            )
        ),
        Enum<1u8>(
            Tuple(
                Enum<1u8>(
                    Enum<1u8>()
                ),
                Enum<1u8>(
                    Enum<1u8>()
                )
            )
        ),
        Enum<1u8>(
            Tuple(
                Enum<1u8>(
                    Enum<1u8>()
                ),
                Enum<1u8>(
                    Enum<1u8>()
                )
            )
        ),
        Enum<1u8>(
            Tuple(
                Enum<1u8>(
                    Enum<0u8>()
                ),
                Enum<1u8>(
                    Enum<1u8>()
                )
            )
        ),
        Enum<1u8>(
            Tuple(
                Enum<1u8>(
                    Enum<0u8>()
                ),
                Enum<1u8>(
                    Enum<1u8>()
                )
            )
        )
    )
    Tuple(
        Map<String, Tuple>(
            "name" => Tuple(
                Enum<1u8>(
                    Enum<0u8>(
                        "Radix Web3 token"
                    )
                ),
                false
            ),
            "symbol" => Tuple(
                Enum<1u8>(
                    Enum<0u8>(
                        "WEB3"
                    )
                ),
                false
            )
        ),
        Map<String, Enum>(
            "metadata_setter" => Enum<0u8>(),
            "metadata_setter_updater" => Enum<0u8>(),
            "metadata_locker" => Enum<0u8>(),
            "metadata_locker_updater" => Enum<0u8>()
        )
    )
    Enum<0u8>()
;

CALL_METHOD
    Address("${accountAddress}")
    "try_deposit_batch_or_abort"
    Expression("ENTIRE_WORKTOP")
    Enum<0u8>()
;`
