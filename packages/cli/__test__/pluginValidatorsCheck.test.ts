import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import { describe, expect, test } from "vitest";
import { createLogger } from "../src/logger.js";
import { createPluginValidatorsCheck } from "../src/validate/checks/pluginValidators.js";
import { createRuleResolver } from "../src/validate/rules.js";
import { createValidationRun } from "../src/validate/run.js";

const EMPTY_SPEC: NormalizedSpec = { resources: [], responses: [] };

const createContext = (overrides: {
  readonly plugins: readonly (string | readonly [string, ...unknown[]])[];
}) => {
  return createValidationRun({
    initialState: {
      spec: EMPTY_SPEC,
      inputPath: "/tmp/spec.ts",
      loadedConfig: {
        input: "/tmp/spec.ts",
        output: "/tmp/out",
        plugins: overrides.plugins,
      },
    },
    logger: createLogger({ quiet: true }),
    execDir: "/tmp",
    temporaryDirectory: "/tmp",
    ruleResolver: createRuleResolver({
      strict: false,
      failOn: "error",
      disable: [],
      enable: [],
    }),
    pluginsEnabled: true,
  });
};

describe("createPluginValidatorsCheck", () => {
  test("emits TW-PLUGIN-LOAD-001 when a declared plugin cannot be loaded", async () => {
    const check = createPluginValidatorsCheck();
    const { state, context } = createContext({
      plugins: ["this-plugin-does-not-exist-anywhere"],
    });

    const outcome = await check.run(context);

    expect(outcome.result.status).toBe("fail");
    expect(state.collectedIssues).toHaveLength(1);
    const [issue] = state.collectedIssues;
    expect(issue?.code).toBe("TW-PLUGIN-LOAD-001");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("this-plugin-does-not-exist-anywhere");
  });

  test("passes when no plugins are declared", async () => {
    const check = createPluginValidatorsCheck();
    const { state, context } = createContext({ plugins: [] });

    const outcome = await check.run(context);

    expect(outcome.result.status).toBe("pass");
    expect(state.collectedIssues).toEqual([]);
  });
});
