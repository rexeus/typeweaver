import { describe, expect, test } from "vitest";
import { createOperationIdStyleCheck } from "../src/validate/checks/operationIdStyle.js";
import { createPathStyleCheck } from "../src/validate/checks/pathStyle.js";
import { createRuleResolver } from "../src/validate/rules.js";
import { createTestLogger } from "./__helpers__/testLogger.js";
import type {
  Issue,
  ValidateCheckContext,
  ValidateState,
} from "../src/validate/types.js";

type StyleCheckRunParams = {
  readonly state: ValidateState;
  readonly enabledRules?: readonly string[];
  readonly pluginsEnabled?: boolean;
};

type StyleCheckRun = {
  readonly context: ValidateCheckContext;
  readonly emitted: Issue[];
};

const createStyleCheckRun = (params: StyleCheckRunParams): StyleCheckRun => {
  const emitted: Issue[] = [];
  const ruleResolver = createRuleResolver({
    strict: false,
    failOn: "error",
    disable: [],
    enable: params.enabledRules ?? [],
  });

  const context: ValidateCheckContext = {
    state: params.state,
    logger: createTestLogger(),
    execDir: "/workspace",
    temporaryDirectory: "/tmp/unused",
    ruleResolver,
    pluginsEnabled: params.pluginsEnabled ?? false,
    emitIssue: issue => {
      emitted.push(issue);
      params.state.collectedIssues.push(issue);
    },
  };

  return { context, emitted };
};

describe("operationIdStyle check", () => {
  test("passes silently when the rule is disabled by default", async () => {
    const check = createOperationIdStyleCheck();
    const { context, emitted } = createStyleCheckRun({
      state: {
        spec: {
          resources: [
            {
              name: "todo",
              operations: [{ operationId: "BAD_ID", method: "GET", path: "/" }],
            },
          ],
          responses: [],
        } as unknown as ValidateState["spec"],
        collectedIssues: [],
      },
    });

    const outcome = await check.run(context);

    expect(outcome.result.status).toBe("pass");
    expect(outcome.result.summary).toContain("disabled");
    expect(emitted).toHaveLength(0);
  });

  test("warns on non-camelCase operation IDs when the rule is enabled", async () => {
    const check = createOperationIdStyleCheck();
    const { context, emitted } = createStyleCheckRun({
      state: {
        spec: {
          resources: [
            {
              name: "todo",
              operations: [
                { operationId: "GetTodo", method: "GET", path: "/todos" },
                { operationId: "get_todo", method: "GET", path: "/todos/:id" },
                { operationId: "fineCase", method: "GET", path: "/ok" },
              ],
            },
          ],
          responses: [],
        } as unknown as ValidateState["spec"],
        collectedIssues: [],
      },
      enabledRules: ["TW-STYLE-001"],
    });

    const outcome = await check.run(context);

    expect(outcome.result.status).toBe("warn");
    expect(emitted).toHaveLength(2);
    expect(emitted.map(issue => issue.code)).toEqual([
      "TW-STYLE-001",
      "TW-STYLE-001",
    ]);
  });
});

describe("pathStyle check", () => {
  test("ignores parameter segments and warns on non-kebab-case static segments", async () => {
    const check = createPathStyleCheck();
    const { context, emitted } = createStyleCheckRun({
      state: {
        spec: {
          resources: [
            {
              name: "todo",
              operations: [
                {
                  operationId: "getTodo",
                  method: "GET",
                  path: "/api/todoItems/{todoId}",
                },
                {
                  operationId: "kebabOk",
                  method: "GET",
                  path: "/api/todo-items/{todoId}",
                },
              ],
            },
          ],
          responses: [],
        } as unknown as ValidateState["spec"],
        collectedIssues: [],
      },
      enabledRules: ["TW-STYLE-002"],
    });

    const outcome = await check.run(context);

    expect(outcome.result.status).toBe("warn");
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual(
      expect.objectContaining({
        code: "TW-STYLE-002",
        message: expect.stringContaining("'todoItems'"),
      })
    );
  });

  test("passes when the style rule is disabled", async () => {
    const check = createPathStyleCheck();
    const { context, emitted } = createStyleCheckRun({
      state: {
        spec: {
          resources: [
            {
              name: "todo",
              operations: [
                {
                  operationId: "getTodo",
                  method: "GET",
                  path: "/api/TodoItems",
                },
              ],
            },
          ],
          responses: [],
        } as unknown as ValidateState["spec"],
        collectedIssues: [],
      },
    });

    const outcome = await check.run(context);

    expect(outcome.result.status).toBe("pass");
    expect(emitted).toHaveLength(0);
  });
});
