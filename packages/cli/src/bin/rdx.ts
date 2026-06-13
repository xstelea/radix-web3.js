#!/usr/bin/env node
import { NodeRuntime, NodeServices } from '@effect/platform-node';
import {
  Console,
  Context,
  Data,
  Effect,
  Layer,
  Option,
  Schema,
  Terminal,
} from 'effect';
import { CliError } from 'effect/unstable/cli';

import { cli } from '../cli';
import { renderJson } from '../json';

const CliBuiltInRenderFlagSchema = Schema.Literals([
  '--help',
  '-h',
  '--version',
  '--wizard',
  '--completions',
]);
const shouldRenderCliTerminal = (argv: ReadonlyArray<string>) =>
  argv.some(Schema.is(CliBuiltInRenderFlagSchema));

const quietTerminal = Terminal.make({
  columns: Effect.succeed(80),
  rows: Effect.succeed(24),
  readInput: Effect.die('rdx is non-interactive'),
  readLine: Effect.die('rdx is non-interactive'),
  display: () => Effect.void,
});

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

const decodeUnknownOption = <S extends Schema.Decoder<unknown>>(
  schema: S,
  value: unknown,
) => Option.getOrUndefined(Schema.decodeUnknownOption(schema)(value));

class CliFailure extends Data.TaggedError('CliFailure')<{
  code: string;
  message: string;
}> {}

const reasonMessage = (reason: unknown) => {
  if (reason === undefined) {
    return '';
  }

  if (reason instanceof Error) {
    return `: ${reason.message}`;
  }

  if (typeof reason === 'string') {
    return `: ${reason}`;
  }

  return `: ${renderJson(reason)}`;
};

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
    const reason = reasonMessage(taggedError.reason);

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
    (CliError.isCliError(error) && error._tag === 'UnknownSubcommand') ||
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
    Effect.andThen(
      Effect.sync(() => {
        process.exitCode = 64;
      }),
    ),
  );

class RdxCliRuntime extends Context.Service<RdxCliRuntime>()('RdxCliRuntime', {
  make: Effect.gen(function* () {
    const terminal = yield* Terminal.Terminal;

    return {
      run: (argv: ReadonlyArray<string>) =>
        suppressCliValidationText(argv).pipe(
          Effect.andThen(
            Effect.suspend(() => cli([...argv])).pipe(
              Effect.provideService(
                Terminal.Terminal,
                shouldRenderCliTerminal(argv) ? terminal : quietTerminal,
              ),
              Effect.provide(NodeServices.layer),
            ),
          ),
          Effect.catch((error) => reportCliFailure(normalizeCliFailure(error))),
        ),
    };
  }),
}) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make);
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(NodeServices.layer),
  );

  static readonly run = (argv: ReadonlyArray<string>) =>
    Effect.flatMap(this, (runtime) => runtime.run(argv));
}

RdxCliRuntime.run(process.argv).pipe(
  Effect.provide(RdxCliRuntime.Default),
  NodeRuntime.runMain,
);
