import { LOAD_SPEC_ID } from "./loadSpec.js";
import { createCheckHelpers } from "./support.js";
import type { Issue, ValidateCheck } from "../types.js";

export const PATH_STYLE_ID = "style/path-kebab-case";

const IDENTITY = { id: PATH_STYLE_ID, label: "Path style" } as const;

const KEBAB_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const isParameterSegment = (segment: string): boolean => {
  return segment.startsWith(":") || segment.startsWith("{");
};

export const createPathStyleCheck = (): ValidateCheck => {
  const helpers = createCheckHelpers(IDENTITY);

  return {
    ...IDENTITY,
    dependsOn: [LOAD_SPEC_ID],
    run: async context => {
      if (!context.ruleResolver.isEnabled("TW-STYLE-002")) {
        return helpers.pass("Path style check disabled.");
      }

      const spec = context.state.spec;
      if (!spec) {
        return helpers.pass("No spec loaded; nothing to check.");
      }

      const issues: Issue[] = [];

      for (const resource of spec.resources) {
        for (const operation of resource.operations) {
          const offendingSegments = operation.path
            .split("/")
            .filter(segment => segment.length > 0)
            .filter(segment => !isParameterSegment(segment))
            .filter(segment => !KEBAB_SEGMENT.test(segment));

          if (offendingSegments.length === 0) {
            continue;
          }

          const issue: Issue = {
            code: "TW-STYLE-002",
            severity: "warning",
            message: `Route '${operation.method} ${operation.path}' uses non-kebab-case segment(s): ${offendingSegments.map(segment => `'${segment}'`).join(", ")}.`,
            path: `/resources/${resource.name}/operations/${operation.operationId}`,
            hint: "Use lower-case letters, digits, and dashes only for path segments.",
          };

          issues.push(issue);
          context.emitIssue(issue);
        }
      }

      return helpers.finalize(issues, context.ruleResolver, {
        pass: "All route segments follow kebab-case.",
        warn: count => `${count} route(s) violate kebab-case convention.`,
        fail: count => `${count} route(s) violate kebab-case convention.`,
      });
    },
  };
};
