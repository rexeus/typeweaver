import { processWorkspaces } from "../helpers/builtCli.js";
import { writeHealthSpec } from "../helpers/specFiles.js";
import type { HealthSpecOptions } from "../helpers/specFiles.js";

export const { createWorkspace, removeWorkspaces } =
  processWorkspaces("cli-process");

export const writeSpec = (
  workspace: string,
  options: Pick<HealthSpecOptions, "duplicateOperationId"> = {}
): string => writeHealthSpec(workspace, { ...options, title: "Health API" });
