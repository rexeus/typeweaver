import type { Issue, NormalizedSpec } from "@rexeus/typeweaver-gen";

const PATH_PARAMETER_PATTERN = /:[A-Za-z0-9_]+/;
const STANDALONE_PATH_PARAMETER_PATTERN = /^:[A-Za-z0-9_]+$/;

const usesEmbeddedPathParameter = (path: string): boolean =>
  path
    .split("/")
    .some(
      segment =>
        PATH_PARAMETER_PATTERN.test(segment) &&
        !STANDALONE_PATH_PARAMETER_PATTERN.test(segment)
    );

export const validateHonoSpec = (spec: NormalizedSpec): readonly Issue[] => {
  const issues: Issue[] = [];

  for (const [resourceIndex, resource] of spec.resources.entries()) {
    for (const [operationIndex, operation] of resource.operations.entries()) {
      if (!usesEmbeddedPathParameter(operation.path)) continue;

      issues.push({
        code: "TW-PLUGIN-HONO-001",
        severity: "error",
        message: `Operation '${operation.operationId}' embeds a path parameter within a segment, which Hono cannot extract faithfully.`,
        path: `/resources/${resourceIndex}/operations/${operationIndex}/path`,
        hint: "Place each path parameter in its own slash-delimited segment when generating Hono routers.",
        fixable: false,
      });
    }
  }

  return issues;
};
