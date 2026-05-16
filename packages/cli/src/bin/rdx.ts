#!/usr/bin/env node
import { ValidationError } from '@effect/cli';
import { NodeContext, NodeRuntime } from '@effect/platform-node';
import { FileSystem, Path } from '@effect/platform';
import {
  Terminal,
  type Terminal as TerminalService,
} from '@effect/platform/Terminal';
import { Console, Data, Effect, Option, Schema } from 'effect';
import { cli } from '../cli';
import { renderJson } from '../json';

const CliBuiltInRenderFlagSchema = Schema.Literal(
  '--help',
  '-h',
  '--version',
  '--wizard',
  '--completions',
);
const shouldRenderCliTerminal = (argv: ReadonlyArray<string>) =>
  argv.some(Schema.is(CliBuiltInRenderFlagSchema));

const quietTerminal = {
  columns: Effect.succeed(80),
  rows: Effect.succeed(24),
  isTTY: Effect.succeed(false),
  readInput: Effect.dieMessage('rdx is non-interactive'),
  readLine: Effect.dieMessage('rdx is non-interactive'),
  display: () => Effect.void,
} as TerminalService;

let hasSuppressedCliValidationText = false;

const suppressCliValidationText = (argv: ReadonlyArray<string>) =>
  Effect.sync(() => {
    if (shouldRenderCliTerminal(argv) || hasSuppressedCliValidationText) {
      return;
    }

    hasSuppressedCliValidationText = true;
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
  });

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

class CliFailure extends Data.TaggedError('CliFailure')<{
  code: string;
  message: string;
}> {}

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
  if (
    (ValidationError.isValidationError(error) &&
      ValidationError.isMissingSubcommand(error)) ||
    message.startsWith('Invalid subcommand')
  ) {
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

const normalizeCliFailure = (error: unknown) => {
  const message = validationMessage(error);

  return new CliFailure({
    code: validationCode(error, message),
    message,
  });
};

const reportCliFailure = (failure: CliFailure) =>
  Console.error(
    renderJson({
      type: 'error',
      code: failure.code,
      message: failure.message,
    }),
  ).pipe(
    Effect.zipRight(
      Effect.sync(() => {
        process.exitCode = 64;
      }),
    ),
  );

class RdxCliRuntime extends Effect.Service<RdxCliRuntime>()('RdxCliRuntime', {
  accessors: true,
  effect: Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const terminal = yield* Terminal;

    return {
      run: (argv: ReadonlyArray<string>) =>
        suppressCliValidationText(argv).pipe(
          Effect.zipRight(
            Effect.suspend(() => cli([...argv])).pipe(
              Effect.provideService(FileSystem.FileSystem, fileSystem),
              Effect.provideService(Path.Path, path),
              Effect.provideService(
                Terminal,
                shouldRenderCliTerminal(argv) ? terminal : quietTerminal,
              ),
            ),
          ),
          Effect.catchAll((error) =>
            reportCliFailure(normalizeCliFailure(error)),
          ),
        ),
    };
  }),
  dependencies: [NodeContext.layer],
}) {}

RdxCliRuntime.run(process.argv).pipe(
  Effect.provide(RdxCliRuntime.Default),
  NodeRuntime.runMain,
);
