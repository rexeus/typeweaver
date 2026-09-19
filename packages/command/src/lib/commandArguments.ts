import { readFile } from "node:fs/promises";
import { CommandUsageError } from "./commandExitCodes.js";
import type {
  GeneratedCommand,
  GeneratedCommandInput,
  GeneratedCommandIo,
  GeneratedCommandRequest,
} from "./types.js";

export type ParsedArguments = {
  readonly commandName?: string;
  readonly values: ReadonlyMap<string, readonly string[]>;
  readonly switches: ReadonlySet<string>;
};

const SWITCH_OPTIONS = new Set(["help", "human", "body-stdin"]);
const GLOBAL_VALUE_OPTIONS = new Set(["base-url", "body", "body-file"]);

export const defaultIo = (): GeneratedCommandIo => ({
  argv: process.argv.slice(2),
  env: process.env,
  stdinIsTTY: process.stdin.isTTY === true,
  readFile: filePath => readFile(filePath, "utf8"),
  readStdin: readProcessStdin,
  writeStdout: value => process.stdout.write(value),
  writeStderr: value => process.stderr.write(value),
});

export const parseArguments = (argv: readonly string[]): ParsedArguments => {
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

export const onlyValue = (
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

export const validateKnownOptions = (
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

export const requestFromInputs = (
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

export const readBody = async (
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

const readProcessStdin = async (): Promise<string> => {
  let value = "";
  for await (const chunk of process.stdin) value += String(chunk);
  return value;
};

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

const knownOptions = (command: GeneratedCommand): ReadonlySet<string> =>
  new Set([
    ...SWITCH_OPTIONS,
    ...GLOBAL_VALUE_OPTIONS,
    ...command.inputs.map(input => input.flag),
    ...command.security.schemes.map(scheme => scheme.flag),
  ]);

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

const parseBodyValue = (source: string, command: GeneratedCommand): unknown => {
  if (command.bodyTransport !== "json") return source;
  try {
    return JSON.parse(source);
  } catch {
    throw new CommandUsageError("Request body is not valid JSON.");
  }
};
