# Radix Effects

A TypeScript library providing Effect.js-based utilities for interacting with the Radix DLT network. This package offers functional programming patterns for blockchain operations with built-in error handling, composability, and type safety.

## Features

- **Effect.js Integration**: Leverages Effect.js for functional programming patterns with error handling and composability
- **Gateway API Wrapper**: Comprehensive wrapper around the Radix Gateway API with type-safe operations
- **Fungible & Non-Fungible Token Support**: Get balances and manage both fungible and non-fungible resources
- **Component State Management**: Query and interact with Radix component states
- **Validator Operations**: Retrieve validator information and staking data
- **Key-Value Store Access**: Read from component key-value stores
- **Staking Operations**: Comprehensive staking utilities including position tracking and LSU conversions
- **DApp Integrations**: Pre-built integrations for popular Radix DApps (CaviarNine, Root Finance, Weft Finance)
- **Utility Helpers**: Common utilities for date handling, JSON parsing, and data chunking
- **Built-in Error Handling**: Comprehensive error types for different failure scenarios
- **TypeScript First**: Full TypeScript support with strict type checking

## Installation

```bash
npm install radix-effects
```

```bash
pnpm add radix-effects
```

```bash
yarn add radix-effects
```

## Quick Start

```typescript
import { Effect, Layer } from "effect";
import { 
  GetFungibleBalanceService, 
  GetFungibleBalanceLive,
  GatewayApiClientLive 
} from "radix-effects";

// Create the runtime layer
const AppLayer = Layer.mergeAll(
  GatewayApiClientLive,
  GetFungibleBalanceLive
);

// Get fungible token balances
const program = Effect.gen(function* () {
  const getFungibleBalance = yield* GetFungibleBalanceService;
  
  const balances = yield* getFungibleBalance({
    addresses: ["account_rdx12..."],
    at_ledger_state: { state_version: 12345678 }
  });
  
  return balances;
});

// Run the program
const result = await Effect.runPromise(
  Effect.provide(program, AppLayer)
);
```

## Gateway API Services

### Fungible Token Operations

```typescript
import { GetFungibleBalanceService } from "radix-effects";

// Get fungible token balances for multiple accounts
const balances = yield* getFungibleBalance({
  addresses: ["account_rdx12...", "account_rdx13..."],
  options: {
    fungible_resources: true,
    explicit_metadata: ["name", "symbol"]
  },
  at_ledger_state: { state_version: 12345678 }
});
```

### Non-Fungible Token Operations

```typescript
import { GetNonFungibleBalanceService } from "radix-effects";

// Get NFT balances and data
const nftBalances = yield* getNonFungibleBalance({
  addresses: ["account_rdx12..."],
  at_ledger_state: { state_version: 12345678 }
});
```

### Component State Queries

```typescript
import { GetComponentStateService } from "radix-effects";

// Query component state
const componentState = yield* getComponentState({
  address: "component_rdx1c...",
  at_ledger_state: { state_version: 12345678 }
});
```

### Validator Information

```typescript
import { GetAllValidatorsService } from "radix-effects";

// Get all validators
const validators = yield* getAllValidators({
  at_ledger_state: { state_version: 12345678 }
});
```

### Key-Value Store Access

```typescript
import { GetKeyValueStoreService } from "radix-effects";

// Read from component key-value store
const kvData = yield* getKeyValueStore({
  address: "component_rdx1c...",
  keys: ["key1", "key2"],
  at_ledger_state: { state_version: 12345678 }
});
```

## Staking Operations

### Get User Staking Positions

```typescript
import { GetUserStakingPositionsService } from "radix-effects";

// Get staking positions for accounts
const stakingPositions = yield* getUserStakingPositions({
  addresses: ["account_rdx12..."],
  at_ledger_state: { state_version: 12345678 }
});

// Returns staked LSU tokens and unstaked claim NFTs
console.log(stakingPositions.items[0].staked); // LSU tokens
console.log(stakingPositions.items[0].unstaked); // Claim NFTs with epochs
```

### Convert LSU to XRD

```typescript
import { ConvertLsuToXrdService } from "radix-effects";

// Get LSU to XRD conversion rates
const converters = yield* convertLsuToXrd({
  addresses: ["resource_rdx1t4..."], // LSU resource addresses
  at_ledger_state: { state_version: 12345678 }
});

// Convert LSU amount to XRD equivalent
const xrdAmount = converters[0].converter(new BigNumber("100"));
```

## DApp Integrations

### CaviarNine DEX

```typescript
import { 
  GetShapeLiquidityAssetsService,
  GetLsulpService,
  GetQuantaSwapBinMapService 
} from "radix-effects";

// Get liquidity positions
const liquidityAssets = yield* getShapeLiquidityAssets({
  addresses: ["account_rdx12..."],
  at_ledger_state: { state_version: 12345678 }
});

// Get LSULP (Liquidity Stake Unit Liquidity Provider) data
const lsulpData = yield* getLsulp({
  address: "component_rdx1c...",
  at_ledger_state: { state_version: 12345678 }
});

// Get swap bin map for trading pairs
const binMap = yield* getQuantaSwapBinMap({
  address: "component_rdx1c...",
  at_ledger_state: { state_version: 12345678 }
});
```

### Root Finance

```typescript
import { GetRootFinancePositionsService } from "radix-effects";

// Get Root Finance lending/borrowing positions
const rootPositions = yield* getRootFinancePositions({
  addresses: ["account_rdx12..."],
  at_ledger_state: { state_version: 12345678 }
});
```

### Weft Finance

```typescript
import { GetWeftFinancePositionsService } from "radix-effects";

// Get Weft Finance positions
const weftPositions = yield* getWeftFinancePositions({
  addresses: ["account_rdx12..."],
  at_ledger_state: { state_version: 12345678 }
});
```

## Helper Utilities

### Data Processing

```typescript
import { chunker, parseJSON, i192 } from "radix-effects";

// Chunk arrays for batch processing
const chunks = chunker(largeArray, 20);

// Safe JSON parsing with Effect
const parsed = yield* parseJSON(jsonString);

// Work with i192 integers
const bigInt = i192.fromString("123456789");
```

### Date Utilities

```typescript
import { getDatesBetweenIntervals, getHourStartInUTC } from "radix-effects";

// Get date intervals
const intervals = getDatesBetweenIntervals(startDate, endDate, "1h");

// Get hour start in UTC
const hourStart = getHourStartInUTC(new Date());
```

## Error Handling

The library provides comprehensive error types for different failure scenarios:

```typescript
import { 
  EntityNotFoundError, 
  InvalidInputError, 
  GatewayError 
} from "radix-effects";

const program = Effect.gen(function* () {
  const result = yield* getFungibleBalance({
    addresses: ["invalid_address"]
  });
  return result;
}).pipe(
  Effect.catchTag("EntityNotFoundError", (error) => 
    Effect.succeed({ error: "Entity not found" })
  ),
  Effect.catchTag("InvalidInputError", (error) => 
    Effect.succeed({ error: "Invalid input provided" })
  ),
  Effect.catchTag("GatewayError", (error) => 
    Effect.succeed({ error: "Gateway API error" })
  )
);
```

## Configuration

### Gateway API Client

```typescript
import { GatewayApiClientLive } from "radix-effects";

// The client uses the Babylon Gateway API SDK
// Configure your gateway endpoint through environment variables
// or by providing a custom configuration layer
```

## API Reference

### Gateway Services

- `GetFungibleBalanceService` - Retrieve fungible token balances
- `GetNonFungibleBalanceService` - Retrieve non-fungible token balances  
- `GetComponentStateService` - Query component states
- `GetEntityDetailsService` - Get entity details
- `GetAllValidatorsService` - Retrieve validator information
- `GetKeyValueStoreService` - Access component key-value stores
- `GetLedgerStateService` - Get current ledger state
- `GetResourceHoldersService` - Find resource holders

### Staking Services

- `GetUserStakingPositionsService` - Get user staking positions (staked LSU + unstaked claims)
- `ConvertLsuToXrdService` - Convert LSU tokens to XRD equivalent amounts

### DApp Services

**CaviarNine DEX:**
- `GetShapeLiquidityAssetsService` - Get liquidity provider positions
- `GetShapeLiquidityClaimsService` - Get liquidity claims
- `GetLsulpService` - Get LSULP data
- `GetLsulpValueService` - Calculate LSULP values
- `GetQuantaSwapBinMapService` - Get swap bin maps for trading pairs

**Root Finance:**
- `GetRootFinancePositionsService` - Get lending/borrowing positions

**Weft Finance:**
- `GetWeftFinancePositionsService` - Get Weft Finance positions

### Helper Functions

- `chunker(array, size)` - Split arrays into chunks
- `parseJSON(string)` - Safe JSON parsing with Effect
- `i192` - Utilities for working with i192 integers
- `getDatesBetweenIntervals(start, end, interval)` - Generate date intervals
- `getHourStartInUTC(date)` - Get hour start in UTC

### Error Types

- `EntityNotFoundError` - Entity not found on network
- `InvalidInputError` - Invalid input parameters
- `GatewayError` - Gateway API errors
- `GetEntityDetailsError` - Entity details retrieval errors

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build the package
npm run build

# Development mode with watch
npm run dev
```

## Requirements

- Node.js 18+
- TypeScript 5+
- Effect.js

## Dependencies

- `effect` - Functional programming library
- `@radixdlt/babylon-gateway-api-sdk` - Radix Gateway API SDK
- `@radixdlt/radix-engine-toolkit` - Radix Engine Toolkit
- `zod` - Schema validation
- `bignumber.js` - Arbitrary precision arithmetic

## License

MIT

## Contributing

Contributions are welcome! Please read the contributing guidelines and submit pull requests to the main repository.

## Related Packages

- `radix-web3.js` - Core Radix Web3 functionality
- `sbor-ez-mode` - SBOR encoding/decoding utilities 