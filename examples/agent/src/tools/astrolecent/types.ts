export type ResourceAddress = string

export type TokenData = {
  resourceAddress: string
  symbol: string
  name: string
  description: string
  iconUrl: string
  infoUrl: string
  divisibility: number
  tokenPriceXRD: number
  tokenPriceUSD: number
  diff24H: number
  diff24HUSD: number
  diff7Days: number
  diff7DaysUSD: number
  volume24H: number
  volume7D: number
  totalSupply: number
  circSupply: number
  tvl: number
  type: null
  tags: string[]
  createdAt: null
  updatedAt: string
  icon_url: string
}

export type SwapInput = {
  inputToken: ResourceAddress // token address
  outputToken: ResourceAddress // token address
  inputAmount: number // in 10^1, not 10^18
  fromAddress: string // account address
  feeComponent?: string // component address for fee capture
  fee?: number // percentage fee (0.01 is 1%)
}

export type SwapResponse = {
  inputTokens: number
  outputTokens: number
  priceImpact: number
  swapFee: string
  manifest: string
  routes: {
    pools: {
      type: string
      baseToken: string
      quoteToken: string
    }[]
    startPrice: string
    endPrice: string
    impact: number
    tokensIn: number
    tokensOut: number
  }[]
}
