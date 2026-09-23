import fs from "node:fs";
import path from "node:path";
import {
  CLI_PROCESS_TIMEOUT_MS,
  processWorkspaces,
  runCli,
} from "../helpers/builtCli.js";

export const { createWorkspace, removeWorkspaces } =
  processWorkspaces("generate-check");

export const writeConfig = (
  workspace: string,
  overrides: readonly string[] = []
): string => {
  const configPath = path.join(workspace, "typeweaver.config.mjs");
  fs.writeFileSync(
    configPath,
    [
      "export default {",
      '  input: "./spec/index.ts",',
      '  output: "./generated",',
      "  format: false,",
      ...overrides,
      "};",
      "",
    ].join("\n")
  );
  return configPath;
};

export const generate = (
  workspace: string,
  args: readonly string[],
  timeoutMs = CLI_PROCESS_TIMEOUT_MS
) => runCli(workspace, ["generate", ...args], { timeoutMs });
