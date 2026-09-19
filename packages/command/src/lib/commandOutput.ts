import { RequestValidationError } from "@rexeus/typeweaver-core";
import { COMMAND_EXIT_CODES, CommandUsageError } from "./commandExitCodes.js";
import type {
  GeneratedCommand,
  GeneratedCommandIo,
  GeneratedCommandProgram,
} from "./types.js";

export const helpText = (
  program: GeneratedCommandProgram,
  command?: GeneratedCommand
): string => {
  if (command === undefined) {
    return [
      `Usage: ${program.programName} <command> [options]`,
      "",
      "Commands:",
      ...program.commands.map(item => `  ${item.name}  ${item.summary}`),
      "",
    ].join("\n");
  }
  return [
    `Usage: ${program.programName} ${command.name} [options]`,
    "",
    command.summary,
    "",
    "Options:",
    "  --base-url <url>",
    ...command.inputs.map(input => `  --${input.flag} <value>`),
    ...command.security.schemes.map(scheme => `  --${scheme.flag} <secret>`),
    ...(command.hasBody
      ? ["  --body <value>", "  --body-file <path>", "  --body-stdin"]
      : []),
    "  --human",
    "  --help",
    "",
  ].join("\n");
};

export const writeSuccess = (
  command: GeneratedCommand,
  response: Awaited<ReturnType<GeneratedCommand["execute"]>>,
  human: boolean,
  io: GeneratedCommandIo
): void => {
  if (human) {
    const body =
      response.body === undefined
        ? ""
        : `\n${JSON.stringify(response.body, null, 2)}`;
    io.writeStdout(
      `${response.statusCode} ${response.type} (${command.operationId})${body}\n`
    );
    return;
  }
  io.writeStdout(
    `${JSON.stringify({ ok: true, operationId: command.operationId, response })}\n`
  );
};

export const classifyFailure = (
  error: unknown,
  signal: AbortSignal,
  human: boolean,
  io: GeneratedCommandIo
): number => {
  if (error instanceof CommandUsageError) {
    return writeError({
      kind: "usage",
      message: error.message,
      exitCode: COMMAND_EXIT_CODES.usage,
      human,
      io,
    });
  }
  if (error instanceof RequestValidationError) {
    return writeError({
      kind: "validation",
      message: error.message,
      exitCode: COMMAND_EXIT_CODES.validation,
      human,
      io,
      details: validationDetails(error),
    });
  }
  if (signal.aborted || (isNetworkError(error) && error.code === "ABORT")) {
    return writeError({
      kind: "cancelled",
      message: "Command cancelled.",
      exitCode: COMMAND_EXIT_CODES.cancelled,
      human,
      io,
    });
  }
  if (isNetworkError(error)) {
    return writeError({
      kind: "network",
      message: "Network request failed.",
      exitCode: COMMAND_EXIT_CODES.network,
      human,
      io,
      details: { code: error.code },
    });
  }
  return writeError({
    kind: "internal",
    message: "Internal command failure.",
    exitCode: COMMAND_EXIT_CODES.internal,
    human,
    io,
  });
};

const validationDetails = (error: RequestValidationError) => ({
  header: error.headerIssues,
  path: error.pathParamIssues,
  query: error.queryIssues,
  body: error.bodyIssues,
});

const isNetworkError = (
  error: unknown
): error is Error & { readonly code: string } =>
  error instanceof Error &&
  error.name === "NetworkError" &&
  "code" in error &&
  typeof error.code === "string";

const writeError = (params: {
  readonly kind: string;
  readonly message: string;
  readonly exitCode: number;
  readonly human: boolean;
  readonly io: GeneratedCommandIo;
  readonly details?: unknown;
}): number => {
  if (params.human) params.io.writeStderr(`${params.message}\n`);
  else {
    params.io.writeStdout(
      `${JSON.stringify({
        ok: false,
        error: {
          kind: params.kind,
          message: params.message,
          exitCode: params.exitCode,
          ...(params.details === undefined ? {} : { details: params.details }),
        },
      })}\n`
    );
  }
  return params.exitCode;
};
