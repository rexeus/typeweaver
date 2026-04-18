import { LOAD_SPEC_ID } from "./loadSpec.js";
import { createCheckHelpers } from "./support.js";
import type { Issue, ValidateCheck } from "../types.js";

export const OPERATION_ID_STYLE_ID = "style/operation-id-case";

const IDENTITY = {
  id: OPERATION_ID_STYLE_ID,
  label: "Operation ID style",
} as const;

const CAMEL_CASE = /^[a-z][a-zA-Z0-9]*$/u;

export const createOperationIdStyleCheck = (): ValidateCheck => {
  const helpers = createCheckHelpers(IDENTITY);

  return {
    ...IDENTITY,
    dependsOn: [LOAD_SPEC_ID],
    run: async context => {
      if (!context.ruleResolver.isEnabled("TW-STYLE-001")) {
        return helpers.pass("Operation ID style check disabled.");
      }

      const spec = context.state.spec;
      if (!spec) {
        return helpers.pass("No spec loaded; nothing to check.");
      }

      const issues: Issue[] = [];

      for (const resource of spec.resources) {
        for (const operation of resource.operations) {
          if (CAMEL_CASE.test(operation.operationId)) {
            continue;
          }

          const issue: Issue = {
            code: "TW-STYLE-001",
            severity: "warning",
            message: `Operation ID '${operation.operationId}' is not camelCase.`,
            path: `/resources/${resource.name}/operations/${operation.operationId}`,
            hint: "Rename the operation to start with a lower-case letter followed by camelCase (e.g. 'getTodo').",
          };

          issues.push(issue);
          context.emitIssue(issue);
        }
      }

      return helpers.finalize(issues, context.ruleResolver, {
        pass: "All operation IDs are camelCase.",
        warn: count =>
          `${count} operation ID(s) violate the camelCase convention.`,
        fail: count =>
          `${count} operation ID(s) violate the camelCase convention.`,
      });
    },
  };
};
