import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { RequestValidationError } from "@rexeus/typeweaver-core";
import type {
  GeneratedCommand,
  GeneratedCommandInput,
  GeneratedCommandIo,
  GeneratedCommandProgram,
  GeneratedCommandRequest,
  GeneratedCommandSecurityScheme,
} from "./types.js";

export const COMMAND_EXIT_CODES = Object.freeze({
  success: 0,
  usage: 2,
  validation: 3,
  http: 4,
  network: 5,
  internal: 6,
  cancelled: 130,
});

class CommandUsageError extends Error {
  public override readonly name = "CommandUsageError";
}

type ParsedArguments = {
  readonly commandName?: string;
  readonly values: ReadonlyMap<string, readonly string[]>;
  readonly switches: ReadonlySet<string>;
};

type SecurityValues = {
  readonly headers: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, string>>;
};

const SWITCH_OPTIONS = new Set(["help", "human", "body-stdin"]);
const GLOBAL_VALUE_OPTIONS = new Set(["base-url", "body", "body-file"]);

const readProcessStdin = async (): Promise<string> => {
  let value = "";
  for await (const chunk of process.stdin) value += String(chunk);
  return value;
};

const defaultIo = (): GeneratedCommandIo => ({
  argv: process.argv.slice(2),
  env: process.env,
  stdinIsTTY: process.stdin.isTTY === true,
  readFile: filePath => readFile(filePath, "utf8"),
  readStdin: readProcessStdin,
  writeStdout: value => process.stdout.write(value),
  writeStderr: value => process.stderr.write(value),
});

const addValue = (
  values: Map<string, string[]>,
  option: string,
  value: string
): void => {
  const existing = values.get(option);
  if (existing === undefined) {
    values.set(option, [value]);
  } else {
    existing.push(value);
  }
};

const parseLongOption = (
  argv: readonly string[],
  index: number
): {
  readonly option: string;
  readonly value?: string;
  readonly consumed: number;
} => {
  const token = argv[index];
  if (token === undefined || !token.startsWith("--")) {
    throw new CommandUsageError("Expected a long option.");
  }
  const assignmentIndex = token.indexOf("=");
  if (assignmentIndex >= 0) {
    return {
      option: token.slice(2, assignmentIndex),
      value: token.slice(assignmentIndex + 1),
      consumed: 1,
    };
  }
  const option = token.slice(2);
  if (SWITCH_OPTIONS.has(option)) return { option, consumed: 1 };
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new CommandUsageError(`Option '--${option}' requires a value.`);
  }
  return { option, value, consumed: 2 };
};

const parseArguments = (argv: readonly string[]): ParsedArguments => {
  const values = new Map<string, string[]>();
  const switches = new Set<string>();
  let commandName: string | undefined;
  let index = 0;
  while (index < argv.length) {
    const token = argv[index];
    if (token?.startsWith("--")) {
      const parsed = parseLongOption(argv, index);
      if (parsed.value === undefined) switches.add(parsed.option);
      else addValue(values, parsed.option, parsed.value);
      index += parsed.consumed;
      continue;
    }
    if (token === undefined) break;
    if (commandName !== undefined) {
      throw new CommandUsageError(`Unexpected positional argument '${token}'.`);
    }
    commandName = token;
    index += 1;
  }
  return {
    ...(commandName === undefined ? {} : { commandName }),
    values,
    switches,
  };
};

const onlyValue = (
  parsed: ParsedArguments,
  option: string
): string | undefined => {
  const values = parsed.values.get(option);
  if (values === undefined) return undefined;
  if (values.length !== 1) {
    throw new CommandUsageError(`Option '--${option}' may be provided once.`);
  }
  return values[0];
};

const knownOptions = (command: GeneratedCommand): ReadonlySet<string> =>
  new Set([
    ...SWITCH_OPTIONS,
    ...GLOBAL_VALUE_OPTIONS,
    ...command.inputs.map(input => input.flag),
    ...command.security.schemes.map(scheme => scheme.flag),
  ]);

const validateKnownOptions = (
  command: GeneratedCommand,
  parsed: ParsedArguments
): void => {
  const known = knownOptions(command);
  for (const option of [...parsed.values.keys(), ...parsed.switches]) {
    if (!known.has(option)) {
      throw new CommandUsageError(`Unknown option '--${option}'.`);
    }
  }
};

const inputValues = (
  input: GeneratedCommandInput,
  parsed: ParsedArguments
): string | string[] | undefined => {
  const values = parsed.values.get(input.flag);
  if (values === undefined) {
    if (input.required) {
      throw new CommandUsageError(`Missing required option '--${input.flag}'.`);
    }
    return undefined;
  }
  if (input.multiple) return [...values];
  if (values.length !== 1) {
    throw new CommandUsageError(
      `Option '--${input.flag}' may be provided once.`
    );
  }
  return values[0];
};

const requestFromInputs = (
  command: GeneratedCommand,
  parsed: ParsedArguments,
  body: unknown
): GeneratedCommandRequest => {
  const param: Record<string, string> = {};
  const query: Record<string, string | string[]> = {};
  const header: Record<string, string | string[]> = {};
  for (const input of command.inputs) {
    const value = inputValues(input, parsed);
    if (value === undefined) continue;
    if (input.target === "path" && typeof value === "string") {
      param[input.key] = value;
    } else if (input.target === "query") {
      query[input.key] = value;
    } else if (input.target === "header") {
      header[input.key] = value;
    }
  }
  return {
    param,
    query,
    header,
    ...(body === undefined ? {} : { body }),
  };
};

const parseBodyValue = (source: string, command: GeneratedCommand): unknown => {
  if (command.bodyTransport !== "json") return source;
  try {
    return JSON.parse(source);
  } catch {
    throw new CommandUsageError("Request body is not valid JSON.");
  }
};

const readBody = async (
  command: GeneratedCommand,
  parsed: ParsedArguments,
  io: GeneratedCommandIo
): Promise<unknown> => {
  const inline = onlyValue(parsed, "body");
  const filePath = onlyValue(parsed, "body-file");
  const stdinRequested = parsed.switches.has("body-stdin");
  const selected = [
    inline !== undefined,
    filePath !== undefined,
    stdinRequested,
  ].filter(Boolean).length;
  if (selected > 1) {
    throw new CommandUsageError(
      "Use only one of '--body', '--body-file', or '--body-stdin'."
    );
  }
  if (!command.hasBody) {
    if (selected > 0) {
      throw new CommandUsageError(
        `Command '${command.name}' does not accept a request body.`
      );
    }
    return undefined;
  }
  if (inline !== undefined) return parseBodyValue(inline, command);
  if (filePath !== undefined) {
    return parseBodyValue(await io.readFile(filePath), command);
  }
  if (stdinRequested || !io.stdinIsTTY) {
    const stdin = await io.readStdin();
    return stdin.length === 0 ? undefined : parseBodyValue(stdin, command);
  }
  return undefined;
};

const selectedSecuritySchemes = (
  command: GeneratedCommand,
  parsed: ParsedArguments
): readonly GeneratedCommandSecurityScheme[] => {
  if (command.security.requirements.length === 0) return [];
  const requirement = command.security.requirements.find(names =>
    names.every(name => {
      const scheme = command.security.schemes.find(item => item.name === name);
      return scheme !== undefined && parsed.values.has(scheme.flag);
    })
  );
  if (requirement === undefined) {
    const alternatives = command.security.requirements
      .map(names =>
        names
          .map(name =>
            command.security.schemes.find(item => item.name === name)
          )
          .filter(scheme => scheme !== undefined)
          .map(scheme => `--${scheme.flag}`)
          .join(" + ")
      )
      .join(" or ");
    throw new CommandUsageError(
      `Missing authentication. Provide ${alternatives}.`
    );
  }
  return requirement.flatMap(name => {
    const scheme = command.security.schemes.find(item => item.name === name);
    return scheme === undefined ? [] : [scheme];
  });
};

const applySecurityScheme = (
  scheme: GeneratedCommandSecurityScheme,
  credential: string,
  headers: Record<string, string>,
  query: Record<string, string>
): void => {
  if (scheme.kind === "http") {
    headers.Authorization =
      scheme.scheme === "basic"
        ? `Basic ${Buffer.from(credential, "utf8").toString("base64")}`
        : `Bearer ${credential}`;
    return;
  }
  if (scheme.kind !== "apiKey") {
    headers.Authorization = `Bearer ${credential}`;
    return;
  }
  if (scheme.location === "header") {
    headers[scheme.credentialName] = credential;
  } else if (scheme.location === "query") {
    query[scheme.credentialName] = credential;
  } else {
    const entry = `${encodeURIComponent(scheme.credentialName)}=${encodeURIComponent(credential)}`;
    headers.Cookie =
      headers.Cookie === undefined ? entry : `${headers.Cookie}; ${entry}`;
  }
};

const resolveSecurity = (
  command: GeneratedCommand,
  parsed: ParsedArguments
): SecurityValues => {
  const headers: Record<string, string> = {};
  const query: Record<string, string> = {};
  for (const scheme of selectedSecuritySchemes(command, parsed)) {
    const credential = onlyValue(parsed, scheme.flag);
    if (credential === undefined) {
      throw new CommandUsageError(`Missing option '--${scheme.flag}'.`);
    }
    applySecurityScheme(scheme, credential, headers, query);
  }
  return { headers, query };
};

const helpText = (
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

const writeSuccess = (
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

const classifyFailure = (
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

const runCommand = async (
  program: GeneratedCommandProgram,
  parsed: ParsedArguments,
  io: GeneratedCommandIo
): Promise<number> => {
  const human = parsed.switches.has("human");
  if (parsed.commandName === undefined) {
    if (parsed.switches.has("help")) {
      io.writeStdout(helpText(program));
      return COMMAND_EXIT_CODES.success;
    }
    throw new CommandUsageError("A command name is required.");
  }
  const command = program.commands.find(
    item => item.name === parsed.commandName
  );
  if (command === undefined) {
    throw new CommandUsageError(`Unknown command '${parsed.commandName}'.`);
  }
  validateKnownOptions(command, parsed);
  if (parsed.switches.has("help")) {
    io.writeStdout(helpText(program, command));
    return COMMAND_EXIT_CODES.success;
  }
  const baseUrl = onlyValue(parsed, "base-url") ?? io.env.TYPEWEAVER_BASE_URL;
  if (baseUrl === undefined || baseUrl.trim().length === 0) {
    throw new CommandUsageError("Provide '--base-url' or TYPEWEAVER_BASE_URL.");
  }
  const body = await readBody(command, parsed, io);
  const request = requestFromInputs(command, parsed, body);
  const security = resolveSecurity(command, parsed);
  const controller = new AbortController();
  const abort = (): void => controller.abort();
  process.once("SIGINT", abort);
  try {
    const response = await command.execute({
      baseUrl,
      request,
      defaultHeaders: security.headers,
      defaultQuery: security.query,
      signal: controller.signal,
    });
    writeSuccess(command, response, human, io);
    return response.statusCode >= 400
      ? COMMAND_EXIT_CODES.http
      : COMMAND_EXIT_CODES.success;
  } catch (error) {
    return classifyFailure(error, controller.signal, human, io);
  } finally {
    process.off("SIGINT", abort);
  }
};

export const runGeneratedCommandCli = async (
  program: GeneratedCommandProgram,
  io: GeneratedCommandIo = defaultIo()
): Promise<number> => {
  let parsed: ParsedArguments | undefined;
  try {
    parsed = parseArguments(io.argv);
    return await runCommand(program, parsed, io);
  } catch (error) {
    return classifyFailure(
      error,
      new AbortController().signal,
      parsed?.switches.has("human") ?? false,
      io
    );
  }
};
