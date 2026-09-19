import {
  defaultIo,
  onlyValue,
  parseArguments,
  readBody,
  requestFromInputs,
  validateKnownOptions,
} from "./commandArguments.js";
import { COMMAND_EXIT_CODES, CommandUsageError } from "./commandExitCodes.js";
import { classifyFailure, helpText, writeSuccess } from "./commandOutput.js";
import { resolveSecurity } from "./commandSecurity.js";
import type { ParsedArguments } from "./commandArguments.js";
import type { GeneratedCommandIo, GeneratedCommandProgram } from "./types.js";

export { COMMAND_EXIT_CODES };

const runCommand = async (
  program: GeneratedCommandProgram,
  parsed: ParsedArguments,
  io: GeneratedCommandIo,
): Promise<number> => {
  const human = parsed.switches.has("human");
  if (parsed.commandName === undefined) {
    if (parsed.switches.has("help")) {
      io.writeStdout(helpText(program));
      return COMMAND_EXIT_CODES.success;
    }
    throw new CommandUsageError("A command name is required.");
  }
  const command = program.commands.find((item) => item.name === parsed.commandName);
  if (command === undefined) {
    throw new CommandUsageError(`Unknown command '${parsed.commandName}'.`);
  }
  validateKnownOptions(command, parsed);
  if (parsed.switches.has("help")) {
    io.writeStdout(helpText(program, command));
    return COMMAND_EXIT_CODES.success;
  }
  const baseUrl = onlyValue(parsed, "base-url") ?? io.env["TYPEWEAVER_BASE_URL"];
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
    return response.statusCode >= 400 ? COMMAND_EXIT_CODES.http : COMMAND_EXIT_CODES.success;
  } catch (error) {
    return classifyFailure(error, controller.signal, human, io);
  } finally {
    process.off("SIGINT", abort);
  }
};

export const runGeneratedCommandCli = async (
  program: GeneratedCommandProgram,
  io: GeneratedCommandIo = defaultIo(),
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
      io,
    );
  }
};
