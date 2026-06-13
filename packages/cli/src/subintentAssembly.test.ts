import { it } from '@effect/vitest';
import { Effect } from 'effect';
import { describe, expect } from 'vitest';

import { assembleRootManifest } from './subintentAssembly';

const rootWithChildren = `
CALL_METHOD
  Address("component_rdx1...")
  "method"
;

YIELD_TO_CHILD
  NamedIntent("child_one")
;

YIELD_TO_CHILD NamedIntent("child-two");
`;

describe('subintent assembly', () => {
  it.effect('leaves root manifests unchanged when no subintents are used', () =>
    Effect.gen(function* () {
      const rootManifest = 'CALL_METHOD Address("a") "method";';

      const assembled = yield* assembleRootManifest({
        rootManifest,
        childIntentHashes: {},
      });

      expect(assembled.rootManifest).toBe(rootManifest);
      expect(assembled.subintentOrder).toEqual([]);
    }),
  );

  it.effect('injects USE_CHILD declarations before root instructions', () =>
    Effect.gen(function* () {
      const assembled = yield* assembleRootManifest({
        rootManifest: rootWithChildren,
        childIntentHashes: {
          child_one: 'subtxid_child_one',
          'child-two': 'subtxid_child_two',
        },
      });

      expect(assembled.subintentOrder).toEqual(['child_one', 'child-two']);
      expect(
        assembled.rootManifest.trimStart().startsWith(`USE_CHILD
  NamedIntent("child_one")
  Intent("subtxid_child_one")
;

USE_CHILD
  NamedIntent("child-two")
  Intent("subtxid_child_two")
;`),
      ).toBe(true);
      expect(assembled.rootManifest).toContain(rootWithChildren.trim());
    }),
  );

  it.effect('fails when the root references a missing child subintent', () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(
        assembleRootManifest({
          rootManifest: rootWithChildren,
          childIntentHashes: {
            child_one: 'subtxid_child_one',
          },
        }),
      );

      expect(result._tag).toBe('Failure');
    }),
  );

  it.effect('fails when a provided child is not yielded by the root', () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(
        assembleRootManifest({
          rootManifest: 'YIELD_TO_CHILD NamedIntent("child_one");',
          childIntentHashes: {
            child_one: 'subtxid_child_one',
            unused: 'subtxid_unused',
          },
        }),
      );

      expect(result._tag).toBe('Failure');
    }),
  );
});
