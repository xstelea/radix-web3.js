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

  return error instanceof Error ? error.message : String(error);
};

const cliEffect = Effect.suspend(() => cli(process.argv)).pipe(
  shouldRenderCliTerminal
    ? (effect) => effect
    : Effect.provideService(Terminal, quietTerminal),
  Effect.catchAll((error) =>
    Effect.sync(() => {
      const message = validationMessage(error);
      const code = message.startsWith('Invalid subcommand')
        ? 'UNKNOWN_COMMAND'
        : 'CLI_VALIDATION_ERROR';
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
