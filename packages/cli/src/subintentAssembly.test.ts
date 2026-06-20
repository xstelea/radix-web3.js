import { assert, describe, it } from '@effect/vitest';
import { Effect } from 'effect';

import {
  assembleRootManifest,
  SubintentAssemblyError,
} from './subintentAssembly';

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

      assert.strictEqual(assembled.rootManifest, rootManifest);
      assert.deepEqual(assembled.subintentOrder, []);
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

      assert.deepEqual(assembled.subintentOrder, ['child_one', 'child-two']);
      assert.isTrue(
        assembled.rootManifest.trimStart().startsWith(`USE_CHILD
  NamedIntent("child_one")
  Intent("subtxid_child_one")
;

USE_CHILD
  NamedIntent("child-two")
  Intent("subtxid_child_two")
;`),
      );
      assert.include(assembled.rootManifest, rootWithChildren.trim());
    }),
  );

  it.effect('fails when the root references a missing child subintent', () =>
    Effect.gen(function* () {
      const result = yield* Effect.result(
        assembleRootManifest({
          rootManifest: rootWithChildren,
          childIntentHashes: {
            child_one: 'subtxid_child_one',
          },
        }),
      );

      assert.strictEqual(result._tag, 'Failure');
      if (result._tag === 'Failure') {
        assert.instanceOf(result.failure, SubintentAssemblyError);
        assert.strictEqual(result.failure.code, 'MISSING_SUBINTENT');
        assert.strictEqual(result.failure.subintentId, 'child-two');
      }
    }),
  );

  it.effect('fails when a provided child is not yielded by the root', () =>
    Effect.gen(function* () {
      const result = yield* Effect.result(
        assembleRootManifest({
          rootManifest: 'YIELD_TO_CHILD NamedIntent("child_one");',
          childIntentHashes: {
            child_one: 'subtxid_child_one',
            unused: 'subtxid_unused',
          },
        }),
      );

      assert.strictEqual(result._tag, 'Failure');
      if (result._tag === 'Failure') {
        assert.instanceOf(result.failure, SubintentAssemblyError);
        assert.strictEqual(result.failure.code, 'UNREFERENCED_SUBINTENT');
        assert.strictEqual(result.failure.subintentId, 'unused');
      }
    }),
  );

  it.effect('rejects invalid subintent identifiers before assembly', () =>
    Effect.gen(function* () {
      const result = yield* Effect.result(
        assembleRootManifest({
          rootManifest: 'YIELD_TO_CHILD NamedIntent("not allowed");',
          childIntentHashes: {
            'not allowed': 'subtxid_invalid',
          },
        }),
      );

      assert.strictEqual(result._tag, 'Failure');
      if (result._tag === 'Failure') {
        assert.instanceOf(result.failure, SubintentAssemblyError);
        assert.strictEqual(result.failure.code, 'INVALID_SUBINTENT_ID');
        assert.strictEqual(result.failure.subintentId, 'not allowed');
      }
    }),
  );
});
