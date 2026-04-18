import { describe, expect, test } from "vitest";
import {
  CORE_RULES,
  createRuleResolver,
  getCoreRule,
  resolveValidateOptions,
} from "../src/validate/rules.js";
import type { Issue } from "../src/validate/types.js";

const buildIssue = (overrides: Partial<Issue> = {}): Issue => ({
  code: "TW-SPEC-001",
  severity: "error",
  message: "boom",
  ...overrides,
});

describe("createRuleResolver", () => {
  test("disabled codes are filtered out even when explicitly emitted", () => {
    const resolver = createRuleResolver({
      strict: false,
      failOn: "error",
      disable: ["TW-STYLE-001"],
      enable: [],
    });

    expect(resolver.isEnabled("TW-STYLE-001")).toBe(false);
    expect(resolver.isEnabled("TW-SPEC-001")).toBe(true);
  });

  test("codes that are disabled by default can be opted-in via `enable`", () => {
    const resolver = createRuleResolver({
      strict: false,
      failOn: "error",
      disable: [],
      enable: ["TW-STYLE-001"],
    });

    expect(resolver.isEnabled("TW-STYLE-001")).toBe(true);
  });

  test("unknown codes default to enabled (plugin-friendly)", () => {
    const resolver = createRuleResolver({
      strict: false,
      failOn: "error",
      disable: [],
      enable: [],
    });

    expect(resolver.isEnabled("TW-PLUGIN-THIRD-PARTY")).toBe(true);
  });

  test("strict mode promotes warnings to errors", () => {
    const resolver = createRuleResolver({
      strict: true,
      failOn: "error",
      disable: [],
      enable: [],
    });

    expect(resolver.resolveSeverity(buildIssue({ severity: "warning" }))).toBe(
      "error"
    );
    expect(resolver.resolveSeverity(buildIssue({ severity: "info" }))).toBe(
      "info"
    );
  });

  test("non-strict mode preserves the emitted severity", () => {
    const resolver = createRuleResolver({
      strict: false,
      failOn: "error",
      disable: [],
      enable: [],
    });

    expect(resolver.resolveSeverity(buildIssue({ severity: "warning" }))).toBe(
      "warning"
    );
  });

  test("failOn threshold controls which severities fail the run", () => {
    const onError = createRuleResolver({
      strict: false,
      failOn: "error",
      disable: [],
      enable: [],
    });
    const onWarning = createRuleResolver({
      strict: false,
      failOn: "warning",
      disable: [],
      enable: [],
    });

    expect(onError.isFailing("warning")).toBe(false);
    expect(onError.isFailing("error")).toBe(true);

    expect(onWarning.isFailing("info")).toBe(false);
    expect(onWarning.isFailing("warning")).toBe(true);
    expect(onWarning.isFailing("error")).toBe(true);
  });
});

describe("resolveValidateOptions", () => {
  test("overrides beat defaults, defaults beat empties", () => {
    const config = resolveValidateOptions(
      { strict: true, failOn: "warning" },
      { disable: ["TW-SPEC-002"] }
    );

    expect(config).toEqual({
      strict: true,
      failOn: "warning",
      disable: ["TW-SPEC-002"],
      enable: [],
    });
  });

  test("produces sensible defaults when nothing is supplied", () => {
    const config = resolveValidateOptions(undefined);

    expect(config).toEqual({
      strict: false,
      failOn: "error",
      disable: [],
      enable: [],
    });
  });
});

describe("getCoreRule", () => {
  test("returns registered core rule metadata", () => {
    const rule = getCoreRule("TW-SPEC-001");

    expect(rule?.defaultSeverity).toBe("error");
  });

  test("returns undefined for unknown codes", () => {
    expect(getCoreRule("TW-UNKNOWN")).toBeUndefined();
  });
});

test("CORE_RULES registry is internally consistent", () => {
  const codes = new Set(CORE_RULES.map(rule => rule.code));

  expect(codes.size).toBe(CORE_RULES.length);

  for (const rule of CORE_RULES) {
    expect(rule.code).toMatch(/^TW-[A-Z-]+-\d+$|^TW-PLUGIN-CRASH-\d+$/u);
  }
});
