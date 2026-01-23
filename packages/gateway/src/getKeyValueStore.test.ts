import { it, layer } from '@effect/vitest';
import { Effect } from 'effect';
import { GetKeyValueStoreService } from './getKeyValueStore';

layer(GetKeyValueStoreService.Default)('GetKeyValueStoreService', (it) => {
  it.effect(
    'should get key value store',
    Effect.fn(function* () {
      const getKeyValueStore = yield* GetKeyValueStoreService;

      const result = yield* getKeyValueStore({
        address:
          'internal_keyvaluestore_rdx1kzjr763caq96j0kv883vy8gnf3jvrrp7dfm9zr5n0akryvzsxvyujc',
        at_ledger_state: {
          timestamp: new Date('2025-01-01T00:00:00.000Z'),
        },
      });

      expect(result.entries.length).toBeGreaterThan(0);
    }),
  );

  it.effect(
    'should fail on if key value store does not exist at state version',
    Effect.fn(function* () {
      const getKeyValueStore = yield* GetKeyValueStoreService;

      yield* getKeyValueStore({
        address:
          'internal_keyvaluestore_rdx1kzjr763caq96j0kv883vy8gnf3jvrrp7dfm9zr5n0akryvzsxvyujc',
        at_ledger_state: {
          timestamp: new Date('2023-01-01T00:00:00.000Z'),
        },
      }).pipe(
        Effect.catchTag('EntityNotFoundError', () => {
          return Effect.succeed(null);
        }),
      );
    }),
  );
});
