import type { SwapInput, SwapResponse, TokenData } from './types';

import type { ResourceAddress } from './types';

const API_KEY = 'radix-web3';
const BASE_API_URL = `https://api.astrolescent.com/partner/${API_KEY}`;

const callApi = async <T = any>(path: string, options: RequestInit = {}) => {
  return fetch(`${BASE_API_URL}${path}`, {
    headers: {
      Accept: 'application/json',
    },
    ...options,
  })
    .then((res) => res.json())
    .then((data: T) => {
      return data;
    });
};

export const astrolecentApiClient = {
  prices: () => {
    console.log(`${BASE_API_URL}/prices`);
    return callApi<Record<ResourceAddress, TokenData>>('/prices', {
      method: 'GET',
    });
  },
  swap: (input: SwapInput) =>
    callApi<SwapResponse>('/swap', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
} as const;
