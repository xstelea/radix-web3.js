import { layer } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { GatewayApiClient } from './gatewayApiClient';
import { GetResourceHoldersService } from './getResourceHolders';

const testLayer = GetResourceHoldersService.Default.pipe(
  Layer.provide(GatewayApiClient.Default),
);

layer(testLayer)('getResourceHolders', (it) => {
  it.effect(
    'should get the resource holders',
    Effect.fn(function* () {
      const getResourceHolders = yield* GetResourceHoldersService;

      const result = yield* getResourceHolders({
        resourceAddress:
          'resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf',
      });

      expect(result.length).toBeGreaterThan(0);
    }),
  );
});
