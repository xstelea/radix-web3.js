#!/usr/bin/env node
import { NodeContext, NodeRuntime } from '@effect/platform-node';
import {
  Terminal,
  type Terminal as TerminalService,
} from '@effect/platform/Terminal';
import { Effect } from 'effect';
import { cli } from '../cli';

const shouldRenderCliTerminal = process.argv.some(
  (arg) =>
    arg === '--help' ||
    arg === '-h' ||
    arg === '--version' ||
    arg === '--wizard' ||
    arg === '--completions',
);

const quietTerminal = {
  columns: Effect.succeed(80),
  rows: Effect.succeed(24),
  isTTY: Effect.succeed(false),
  readInput: Effect.dieMessage('rdx is non-interactive'),
  readLine: Effect.dieMessage('rdx is non-interactive'),
  display: () => Effect.void,
} as TerminalService;

if (!shouldRenderCliTerminal) {
  const stdoutWrite = process.stdout.write.bind(process.stdout);
  const stderrWrite = process.stderr.write.bind(process.stderr);
  const shouldSuppressCliValidationText = (chunk: unknown) =>
    typeof chunk === 'string' &&
    (chunk.startsWith('Invalid ') ||
      chunk.startsWith('Missing ') ||
      chunk.startsWith('Expected '));

  process.stdout.write = ((chunk: unknown, ...args: unknown[]) =>
    shouldSuppressCliValidationText(chunk)
      ? true
      : stdoutWrite(
          chunk as never,
          ...(args as never[]),
        )) as typeof process.stdout.write;
  process.stderr.write = ((chunk: unknown, ...args: unknown[]) =>
    shouldSuppressCliValidationText(chunk)
      ? true
      : stderrWrite(
          chunk as never,
          ...(args as never[]),
        )) as typeof process.stderr.write;
}

const validationMessage = (error: unknown) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof error.error === 'object' &&
    error.error !== null &&
    'value' in error.error &&
    typeof error.error.value === 'object' &&
    error.error.value !== null &&
    'value' in error.error.value &&
    typeof error.error.value.value === 'string'
  ) {
    return error.error.value.value;
  }

  if (typeof error === 'object' && error !== null && '_tag' in error) {
    const tag = String(error._tag);
    const code =
      'code' in error && typeof error.code === 'string'
        ? error.code
        : undefined;
    const path =
      'path' in error && typeof error.path === 'string'
        ? ` at ${error.path}`
        : '';
    const subintentId =
      'subintentId' in error && typeof error.subintentId === 'string'
        ? ` for ${error.subintentId}`
        : '';
    const reason =
      'reason' in error
        ? error.reason instanceof Error
          ? `: ${error.reason.message}`
          : `: ${String(error.reason)}`
        : '';

    return [tag, code].filter(Boolean).join(' ') + subintentId + path + reason;
  }

  return error instanceof Error ? error.message : String(error);
};

const validationCode = (error: unknown, message: string) => {
  if (message.startsWith('Invalid subcommand')) {
    return 'UNKNOWN_COMMAND';
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }

  if (typeof error === 'object' && error !== null && '_tag' in error) {
    return String(error._tag)
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toUpperCase();
  }

  return 'CLI_VALIDATION_ERROR';
};

const cliEffect = Effect.suspend(() => cli(process.argv)).pipe(
  shouldRenderCliTerminal
    ? (effect) => effect
    : Effect.provideService(Terminal, quietTerminal),
  Effect.catchAll((error) =>
    Effect.sync(() => {
      const message = validationMessage(error);
      const code = validationCode(error, message);
      console.error(
        JSON.stringify({
          type: 'error',
          code,
          message,
        }),
      );
      process.exitCode = 64;
    }),
  ),
);

cliEffect.pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);
