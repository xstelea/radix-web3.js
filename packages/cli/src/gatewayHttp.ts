import { Effect } from 'effect';

import { renderJson } from './json';

const parseResponseBody = (text: string): unknown => {
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export const gatewayErrorMessage = (
  label: string,
  response: Response,
): Effect.Effect<string, unknown> =>
  Effect.gen(function* () {
    const text = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: (reason) => reason,
    });
    const body = parseResponseBody(text);
    const detail = body === undefined ? '' : `: ${renderJson(body)}`;

    return `${label} failed with status ${response.status}${detail}`;
  });

export const gatewayResponseJson = (
  response: Response,
): Effect.Effect<unknown, unknown> =>
  Effect.tryPromise({
    try: () => response.json(),
    catch: (reason) => reason,
  });
