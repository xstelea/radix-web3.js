import { Data, Effect } from 'effect';

export class SubintentAssemblyError extends Data.TaggedError(
  'SubintentAssemblyError',
)<{
  code: 'INVALID_SUBINTENT_ID' | 'MISSING_SUBINTENT' | 'UNREFERENCED_SUBINTENT';
  subintentId: string;
}> {}

export type AssembledRootManifest = {
  rootManifest: string;
  subintentOrder: string[];
};

const subintentIdPattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const yieldToChildPattern = /YIELD_TO_CHILD\s+NamedIntent\("([^"]+)"\)/g;

const uniqueInOrder = (items: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }

  return result;
};

const extractYieldedSubintentIds = (manifest: string) =>
  uniqueInOrder(
    [...manifest.matchAll(yieldToChildPattern)].map((match) => match[1]),
  );

const useChildDeclaration = (
  subintentId: string,
  intentHash: string,
) => `USE_CHILD
  NamedIntent("${subintentId}")
  Intent("${intentHash}")
;`;

export const assembleRootManifest = (input: {
  rootManifest: string;
  childIntentHashes: Record<string, string>;
}): Effect.Effect<AssembledRootManifest, SubintentAssemblyError> =>
  Effect.gen(function* () {
    const providedIds = Object.keys(input.childIntentHashes);
    const yieldedIds = extractYieldedSubintentIds(input.rootManifest);

    for (const subintentId of [...providedIds, ...yieldedIds]) {
      if (!subintentIdPattern.test(subintentId)) {
        return yield* new SubintentAssemblyError({
          code: 'INVALID_SUBINTENT_ID',
          subintentId,
        });
      }
    }

    for (const subintentId of yieldedIds) {
      if (!(subintentId in input.childIntentHashes)) {
        return yield* new SubintentAssemblyError({
          code: 'MISSING_SUBINTENT',
          subintentId,
        });
      }
    }

    for (const subintentId of providedIds) {
      if (!yieldedIds.includes(subintentId)) {
        return yield* new SubintentAssemblyError({
          code: 'UNREFERENCED_SUBINTENT',
          subintentId,
        });
      }
    }

    if (providedIds.length === 0) {
      return {
        rootManifest: input.rootManifest,
        subintentOrder: [],
      };
    }

    const declarations = yieldedIds
      .map((subintentId) =>
        useChildDeclaration(subintentId, input.childIntentHashes[subintentId]),
      )
      .join('\n\n');

    return {
      rootManifest: `${declarations}\n\n${input.rootManifest.trimStart()}`,
      subintentOrder: yieldedIds,
    };
  });

export class SubintentAssembly extends Effect.Service<SubintentAssembly>()(
  'SubintentAssembly',
  {
    sync: () => ({
      assembleRootManifest,
    }),
  },
) {}
