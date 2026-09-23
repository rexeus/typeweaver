import fs from "node:fs";
import path from "node:path";
import { expect } from "vitest";
import { DoctorReportSchema } from "../../src/index.js";
import { processWorkspaces } from "../helpers/builtCli.js";
import { writeHealthSpec } from "../helpers/specFiles.js";
import type { DoctorReport } from "../../src/index.js";
import type { ProcessResult } from "../helpers/builtCli.js";

export const { createWorkspace, removeWorkspaces } =
  processWorkspaces("doctor-process");

export const writeSpec = (workspace: string): void => {
  writeHealthSpec(workspace, { title: "Doctor API" });
};

export const writeWorkspaceManifest = (
  workspace: string,
  effectVersion?: string
): void => {
  fs.writeFileSync(
    path.join(workspace, "package.json"),
    `${JSON.stringify(
      {
        name: "doctor-workspace",
        private: true,
        version: "1.0.0",
        dependencies:
          effectVersion === undefined ? {} : { effect: effectVersion },
      },
      null,
      2
    )}\n`
  );
  if (effectVersion === undefined) {
    return;
  }
  const effectDirectory = path.join(workspace, "node_modules", "effect");
  fs.mkdirSync(effectDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(effectDirectory, "package.json"),
    `${JSON.stringify({ name: "effect", version: effectVersion }, null, 2)}\n`
  );
};

export const writeExternalPlugin = (workspace: string): string => {
  const pluginPath = path.join(workspace, "plugins", "custom.mjs");
  fs.mkdirSync(path.dirname(pluginPath), { recursive: true });
  fs.writeFileSync(
    pluginPath,
    'export default { name: "custom", generate: () => ({}) };\n'
  );
  return pluginPath;
};

export const parseReport = (stdout: string): DoctorReport => {
  const parsed: unknown = JSON.parse(stdout);
  return DoctorReportSchema.parse(parsed);
};

export const checksByCode = (
  report: DoctorReport
): ReadonlyMap<string, DoctorReport["checks"][number]> =>
  new Map(report.checks.map(check => [check.code, check]));

export const expectCheck = async (
  result: ProcessResult,
  code: string
): Promise<DoctorReport["checks"][number]> => {
  expect(result.stderr).toBe("");
  const check = checksByCode(parseReport(result.stdout)).get(code);
  expect(check).toBeDefined();
  if (check === undefined) {
    throw new Error(`missing ${code}`);
  }
  return check;
};
