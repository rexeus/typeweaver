import path from "node:path";
import { validateGroupFiles } from "./documentation-example-files.mjs";
import {
  readManifest,
  validateManifest,
} from "./documentation-example-manifest.mjs";
import {
  getTypeScriptFailures,
  parseTypeScriptConfig,
  validateFixtureInclusion,
} from "./documentation-example-typescript.mjs";

/** @typedef {import("./documentation-example-manifest.mjs").DocumentationGroup} DocumentationGroup */

/**
 * @param {{ workspaceRoot: string, manifestPath: string, requiredGroupIds: readonly string[] }} options
 * @returns {{ failures: string[], groups: DocumentationGroup[] }}
 */
export const verifyDocumentationExamples = ({
  workspaceRoot,
  manifestPath,
  requiredGroupIds,
}) => {
  const manifestResult = readManifest(
    path.resolve(workspaceRoot, manifestPath),
    manifestPath
  );
  if (manifestResult.manifest === undefined) {
    return { failures: manifestResult.failures, groups: [] };
  }
  const validation = validateManifest(
    manifestResult.manifest,
    manifestPath,
    requiredGroupIds
  );
  const failures = [
    ...validation.failures,
    ...validation.groups.flatMap(group =>
      validateGroupFiles(group, workspaceRoot)
    ),
  ];
  if (validation.tsconfig === undefined) {
    return { failures, groups: validation.groups };
  }
  const config = parseTypeScriptConfig(workspaceRoot, validation.tsconfig);
  failures.push(...config.failures);
  if (config.parsedConfig === undefined) {
    return { failures, groups: validation.groups };
  }
  failures.push(
    ...validateFixtureInclusion(
      validation.groups,
      workspaceRoot,
      validation.tsconfig,
      config.parsedConfig
    )
  );
  if (config.failures.length === 0) {
    failures.push(...getTypeScriptFailures(workspaceRoot, config.parsedConfig));
  }
  return { failures, groups: validation.groups };
};
