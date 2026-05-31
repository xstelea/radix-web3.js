import { Effect } from 'effect';
import { isSborKind, sborFail, SborSchema } from '../sborSchema';

export interface MapDefinition<T, U> {
  key: SborSchema<T>;
  value: SborSchema<U>;
}

export class MapSchema<K, V> extends SborSchema<Map<K, V>> {
  public definition: MapDefinition<K, V>;

  constructor(definition: MapDefinition<K, V>) {
    super(['Map']);
    this.definition = definition;
  }

  validate(value: unknown, path: string[]) {
    if (!isSborKind(value, 'Map')) {
      return sborFail('Invalid map structure', path);
    }

    const self = this;
    return Effect.forEach(value.entries, (entry, index) =>
      Effect.gen(function* () {
        const entryPath = [...path, index.toString()];
        if (!entry.key || !entry.value) {
          return yield* sborFail('Invalid map entry', entryPath);
        }

        yield* self.definition.key.validate(entry.key, entryPath);
        yield* self.definition.value.validate(entry.value, entryPath);
      }),
    ).pipe(Effect.asVoid);
  }

  parse(value: unknown, path: string[]) {
    const self = this;
    return Effect.gen(function* () {
      yield* self.validate(value, path);
      if (!isSborKind(value, 'Map')) {
        return yield* sborFail('Invalid map structure', path);
      }

      const entries = yield* Effect.forEach(value.entries, (entry, index) =>
        Effect.gen(function* () {
          const entryPath = [...path, index.toString()];
          if (!entry.key || !entry.value) {
            return yield* sborFail('Invalid map entry', entryPath);
          }
          return [
            yield* self.definition.key.parse(entry.key, entryPath),
            yield* self.definition.value.parse(entry.value, entryPath),
          ] as const;
        }),
      );

      return new Map<K, V>(entries);
    });
  }
}
