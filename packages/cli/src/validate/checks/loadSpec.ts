import path from "node:path";
import { loadSpec } from "../../generators/specLoader.js";
import { mapSpecErrorToIssue } from "./errorMapping.js";
import { createCheckHelpers } from "./support.js";
import type { Issue, ValidateCheck } from "../types.js";

export const LOAD_SPEC_ID = "spec/load";

const IDENTITY = { id: LOAD_SPEC_ID, label: "Spec load" } as const;

const MISSING_INPUT_ISSUE: Issue = {
  code: "TW-SPEC-001",
  severity: "error",
  message: "No input spec entrypoint resolved for validation.",
  hint: "Pass --input or declare 'input' in the config file.",
};

export const createLoadSpecCheck = (): ValidateCheck => {
  const helpers = createCheckHelpers(IDENTITY);

  return {
    ...IDENTITY,
    run: async context => {
      const inputPath = context.state.inputPath;

      if (!inputPath) {
        context.emitIssue(MISSING_INPUT_ISSUE);
        return helpers.fail("No input spec entrypoint to validate.");
      }

      try {
        const { normalizedSpec } = await loadSpec({
          inputFile: inputPath,
          specOutputDir: path.join(context.temporaryDirectory, "spec"),
        });

        return helpers.pass(
          `Spec loaded with ${normalizedSpec.resources.length} resource(s), ${normalizedSpec.responses.length} response(s).`,
          { state: { spec: normalizedSpec } }
        );
      } catch (error) {
        const issue = mapSpecErrorToIssue(error);
        context.emitIssue(issue);

        return helpers.fail(issue.message, {
          details: issue.hint ? [issue.hint] : [],
        });
      }
    },
  };
};
