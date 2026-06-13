import { Schema } from 'effect';

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export const JsonValueSchema: Schema.Schema<JsonValue> = Schema.Json;

const isBigNumberLike = (
  value: unknown,
): value is { toString: () => string; isBigNumber?: boolean } =>
  typeof value === 'object' &&
  value !== null &&
  'isBigNumber' in value &&
  typeof (value as { toString?: unknown }).toString === 'function';

export const toJsonValue = (value: unknown): JsonValue => {
  if (value === undefined) {
    return null;
  }

  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'bigint' || isBigNumberLike(value)) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(toJsonValue);
  }

  if (typeof value === 'object') {
    if (typeof (value as { toJSON?: unknown }).toJSON === 'function') {
      return toJsonValue((value as { toJSON: () => unknown }).toJSON());
    }

    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, toJsonValue(entry)]),
    );
  }

  return String(value);
};

export const renderJson = (value: unknown) =>
  JSON.stringify(toJsonValue(value), null, 2);
