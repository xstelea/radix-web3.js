import s from "sbor-ez-mode";

export const CdpStatus = s.enum([
  { variant: "Healthy", schema: s.tuple([]) },
  { variant: "Liquidated", schema: s.tuple([]) },
  { variant: "Redeemed", schema: s.tuple([]) },
  { variant: "Closed", schema: s.tuple([]) },
  { variant: "Marked", schema: s.tuple([]) },
]);

export const CdpNftData = s.struct({
  key_image_url: s.string(),
  collateral_address: s.address(),
  collateral_amount: s.decimal(),
  pool_debt: s.decimal(),
  collateral_fusd_ratio: s.decimal(),
  interest: s.decimal(),
  last_interest_change: s.instant(),
  status: CdpStatus,
  privileged_borrower: s.option(s.nonFungibleLocalId()),
});

export type CdpNftData = s.infer<typeof CdpNftData>;
