import { ValidationReportSchema } from "../../src/index.js";
import { processWorkspaces } from "../helpers/builtCli.js";
import { writeHealthSpec } from "../helpers/specFiles.js";
import type { ValidationReport } from "../../src/index.js";
import type { HealthSpecOptions } from "../helpers/specFiles.js";

export const { createWorkspace, removeWorkspaces } =
  processWorkspaces("validate-process");

export const writeSpec = (
  workspace: string,
  options: Pick<HealthSpecOptions, "duplicateOperationId"> = {}
): void => {
  writeHealthSpec(workspace, { ...options, title: "Validation API" });
};

export const parseReport = (stdout: string): ValidationReport => {
  const parsed: unknown = JSON.parse(stdout);
  return ValidationReportSchema.parse(parsed);
};
