import { HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import {
  buildValidationReport,
  computeValidationStats,
} from "../src/validate/reporter.js";
import { createRuleResolver } from "../src/validate/rules.js";
import type {
  Issue,
  ValidateCheckResult,
  ValidateState,
} from "../src/validate/types.js";

const baseResolverConfig = {
  strict: false,
  failOn: "error" as const,
  disable: [],
  enable: [],
};

const stateWithSpec = (): ValidateState => ({
  collectedIssues: [],
  spec: {
    resources: [
      {
        name: "todo",
        operations: [
          {
            operationId: "getTodo",
            method: HttpMethod.GET,
            path: "/todos",
            summary: "",
            request: {},
            responses: [],
          },
          {
            operationId: "listTodos",
            method: HttpMethod.GET,
            path: "/todos",
            summary: "",
            request: {},
            responses: [],
          },
        ],
      },
    ],
    responses: [
      {
        name: "NotFound",
        statusCode: HttpStatusCode.NOT_FOUND,
        statusCodeName: "NOT_FOUND",
        description: "",
        kind: "response",
      },
    ],
  },
});

describe("computeValidationStats", () => {
  test("counts severities and spec shape in a single pass", () => {
    const issues: Issue[] = [
      { code: "A", severity: "error", message: "" },
      { code: "B", severity: "error", message: "" },
      { code: "C", severity: "warning", message: "" },
      { code: "D", severity: "info", message: "" },
    ];

    const stats = computeValidationStats(stateWithSpec(), issues);

    expect(stats).toEqual({
      errors: 2,
      warnings: 1,
      infos: 1,
      resources: 1,
      operations: 2,
      responses: 1,
    });
  });

  test("returns zeroed spec counts when no spec was loaded", () => {
    const stats = computeValidationStats({ collectedIssues: [] }, []);

    expect(stats).toEqual({
      errors: 0,
      warnings: 0,
      infos: 0,
      resources: 0,
      operations: 0,
      responses: 0,
    });
  });
});

describe("buildValidationReport", () => {
  const checks: readonly ValidateCheckResult[] = [
    {
      id: "spec/load",
      label: "Spec load",
      status: "pass",
      summary: "ok",
      details: [],
    },
  ];

  test("applies rule filtering and marks the report as failing on error", () => {
    const state: ValidateState = {
      collectedIssues: [
        { code: "TW-SPEC-001", severity: "error", message: "broken" },
      ],
    };

    const report = buildValidationReport(
      state,
      checks,
      createRuleResolver(baseResolverConfig)
    );

    expect(report.hasErrors).toBe(true);
    expect(report.issues).toHaveLength(1);
    expect(report.stats.errors).toBe(1);
    expect(report.failOn).toBe("error");
  });

  test("drops disabled issues from the report", () => {
    const state: ValidateState = {
      collectedIssues: [
        { code: "TW-SPEC-001", severity: "error", message: "broken" },
      ],
    };

    const report = buildValidationReport(
      state,
      checks,
      createRuleResolver({
        ...baseResolverConfig,
        disable: ["TW-SPEC-001"],
      })
    );

    expect(report.hasErrors).toBe(false);
    expect(report.issues).toEqual([]);
    expect(report.stats.errors).toBe(0);
  });

  test("honors --strict by promoting warnings to errors", () => {
    const state: ValidateState = {
      collectedIssues: [
        { code: "TW-STYLE-001", severity: "warning", message: "meh" },
      ],
    };

    const report = buildValidationReport(
      state,
      checks,
      createRuleResolver({
        ...baseResolverConfig,
        strict: true,
        enable: ["TW-STYLE-001"],
      })
    );

    expect(report.issues[0]?.severity).toBe("error");
    expect(report.hasErrors).toBe(true);
  });

  test("mirrors the resolver's effective failOn, not the config file", () => {
    const state: ValidateState = {
      collectedIssues: [
        { code: "TW-STYLE-001", severity: "warning", message: "meh" },
      ],
    };

    const report = buildValidationReport(
      state,
      checks,
      createRuleResolver({
        ...baseResolverConfig,
        failOn: "warning",
        enable: ["TW-STYLE-001"],
      })
    );

    expect(report.failOn).toBe("warning");
    expect(report.hasErrors).toBe(true);
  });
});
