#!/usr/bin/env node
import { NodeContext, NodeRuntime } from '@effect/platform-node';
import {
  Terminal,
  type Terminal as TerminalService,
} from '@effect/platform/Terminal';
import { Effect, Option, Schema } from 'effect';
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

const CliValidationTextSchema = Schema.Struct({
  error: Schema.Struct({
    value: Schema.Struct({
      value: Schema.String,
    }),
  }),
});

const CodedErrorSchema = Schema.Struct({
  code: Schema.String,
});

const TaggedErrorSchema = Schema.Struct({
  _tag: Schema.String,
  code: Schema.optional(Schema.String),
  path: Schema.optional(Schema.String),
  subintentId: Schema.optional(Schema.String),
  reason: Schema.optional(Schema.Unknown),
});

const decodeUnknownOption = <A>(schema: Schema.Schema<A>, value: unknown) =>
  Option.getOrUndefined(Schema.decodeUnknownOption(schema)(value));

const validationMessage = (error: unknown) => {
  const cliValidationText = decodeUnknownOption(CliValidationTextSchema, error);
  if (cliValidationText) {
    return cliValidationText.error.value.value;
  }

  const taggedError = decodeUnknownOption(TaggedErrorSchema, error);
  if (taggedError) {
    const path = taggedError.path ? ` at ${taggedError.path}` : '';
    const subintentId = taggedError.subintentId
      ? ` for ${taggedError.subintentId}`
      : '';
    const reason =
      taggedError.reason === undefined
        ? ''
        : taggedError.reason instanceof Error
          ? `: ${taggedError.reason.message}`
          : `: ${String(taggedError.reason)}`;

    return (
      [taggedError._tag, taggedError.code].filter(Boolean).join(' ') +
      subintentId +
      path +
      reason
    );
  }

  return error instanceof Error ? error.message : String(error);
};

const validationCode = (error: unknown, message: string) => {
  if (message.startsWith('Invalid subcommand')) {
    return 'UNKNOWN_COMMAND';
  }

  const codedError = decodeUnknownOption(CodedErrorSchema, error);
  if (codedError) {
    return codedError.code;
  }

  const taggedError = decodeUnknownOption(TaggedErrorSchema, error);
  if (taggedError) {
    return taggedError._tag.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
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
