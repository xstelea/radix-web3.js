# @radix-effects/gateway

Effect-based Gateway API client for the Radix Network. Works in both Node.js and browser environments.

## Installation

```bash
npm install @radix-effects/gateway effect
```

## Usage

This package provides Effect-based wrappers around the Radix Gateway API, with full support for both Node.js and browser runtimes. See the [Effect docs](https://effect.website) for more details.

### Basic Setup

```typescript
import { Effect } from 'effect';
import { GatewayApiClientService, getEntityDetails } from '@radix-effects/gateway';

const program = Effect.gen(function* () {
  const entityDetails = yield* getEntityDetails({
    address: 'account_rdx12example123456789abcdef123456789abcdef123456789abcdef'
  });
  
  return entityDetails;
});

const result = await Effect.runPromise(
  program.pipe(
    Effect.provide(GatewayApiClientService.Default)
  )
);
```

## Configuration

### Environment Variables (Node.js)

The Gateway client can be configured through environment variables:

- `NETWORK_ID` - Optional Network ID (default: 1 for mainnet)
- `GATEWAY_URL` - Optional Gateway API base URL
- `APPLICATION_NAME` - Optional Application identifier (default: '@')
- `GATEWAY_BASIC_AUTH` - Optional API key for authentication
- `GATEWAY_RETRY_ATTEMPTS` - Optional number of retry attempts (default: 5)

### Browser Runtime Configuration

In browser environments, use ConfigProvider to set configuration:

```typescript
import { Effect, ConfigProvider, Layer } from 'effect';
import { GatewayApiClientService } from '@radix-effects/gateway';

// Create a configuration provider with your settings
const browserConfig = ConfigProvider.fromMap(new Map([
  ['NETWORK_ID', '2'], // Testnet
  ['GATEWAY_URL', 'https://testnet.radixdlt.com'],
  ['APPLICATION_NAME', 'my-dapp'],
  ['GATEWAY_RETRY_ATTEMPTS', '3']
]));

// Create a layer with the config provider
const BrowserGatewayLayer = Layer.provide(
  GatewayApiClientService.Default,
  Layer.setConfigProvider(browserConfig)
);

// Use in your application
const program = Effect.gen(function* () {
  const details = yield* getEntityDetails({ 
    address: 'account_rdx1...' 
  });
  return details;
});

// Run with browser configuration
const result = await Effect.runPromise(
  program.pipe(Effect.provide(BrowserGatewayLayer))
);
```

## License

MIT