import { describe, expect, test } from "vitest";
import {
  lookupSpecErrorEntry,
  SPEC_ERROR_ENTRIES,
  SPEC_LOAD_FAILURE_CODE,
} from "../src/specErrorRegistry.js";
import { mapSpecErrorToIssue } from "../src/validate/checks/errorMapping.js";
import type { SpecErrorRegistryEntry } from "../src/specErrorRegistry.js";

const CODE_PATTERN = /^TW-SPEC-\d{3}$/u;

const instantiate = (entry: SpecErrorRegistryEntry): Error => {
  const instance = Object.create(entry.errorClass.prototype) as Error;
  instance.message = `synthetic-${entry.code}`;
  instance.name = entry.errorClass.name;
  return instance;
};

describe("SPEC_ERROR_ENTRIES (registry contract)", () => {
  test("codes are well-formed and unique across the registry", () => {
    const codes = SPEC_ERROR_ENTRIES.map(entry => entry.code);

    for (const code of codes) {
      expect(code).toMatch(CODE_PATTERN);
    }

    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).not.toContain(SPEC_LOAD_FAILURE_CODE);
  });

  test("every entry declares a non-empty summary and hint", () => {
    for (const entry of SPEC_ERROR_ENTRIES) {
      expect(entry.summary.length).toBeGreaterThan(0);
      expect(entry.hint.length).toBeGreaterThan(0);
    }
  });
});

describe("lookupSpecErrorEntry", () => {
  test.each(SPEC_ERROR_ENTRIES.map(entry => [entry.errorClass.name, entry]))(
    "matches %s to its registered entry via instanceof",
    (_name, entry) => {
      const resolved = lookupSpecErrorEntry(instantiate(entry));

      expect(resolved).toBeDefined();
      expect(resolved?.code).toBe(entry.code);
      expect(resolved?.summary).toBe(entry.summary);
      expect(resolved?.hint).toBe(entry.hint);
    }
  );

  test("returns undefined for a plain Error with no registered class", () => {
    expect(lookupSpecErrorEntry(new Error("plain"))).toBeUndefined();
  });

  test.each([
    ["string", "boom"],
    ["number", 42],
    ["null", null],
    ["undefined", undefined],
    ["plain object", { message: "not an error" }],
  ])("returns undefined for non-Error throwable (%s)", (_label, value) => {
    expect(lookupSpecErrorEntry(value)).toBeUndefined();
  });
});

describe("mapSpecErrorToIssue", () => {
  test.each(SPEC_ERROR_ENTRIES.map(entry => [entry.errorClass.name, entry]))(
    "maps %s to the registered code, severity, and hint",
    (_name, entry) => {
      const error = instantiate(entry);

      expect(mapSpecErrorToIssue(error)).toEqual({
        code: entry.code,
        severity: "error",
        message: `synthetic-${entry.code}`,
        hint: entry.hint,
      });
    }
  );

  test("unknown Error collapses to the fallback code with a non-empty hint", () => {
    const issue = mapSpecErrorToIssue(new Error("something exploded"));

    expect(issue.code).toBe(SPEC_LOAD_FAILURE_CODE);
    expect(issue.severity).toBe("error");
    expect(issue.message).toBe("something exploded");
    expect(issue.hint.length).toBeGreaterThan(0);
  });

  test.each([
    ["string", "plain string", "plain string"],
    ["number", 123, "123"],
    ["null", null, "null"],
    ["undefined", undefined, "undefined"],
  ])(
    "String()-coerces non-Error throwable (%s) into message with fallback code",
    (_label, input, expectedMessage) => {
      const issue = mapSpecErrorToIssue(input);

      expect(issue.code).toBe(SPEC_LOAD_FAILURE_CODE);
      expect(issue.severity).toBe("error");
      expect(issue.message).toBe(expectedMessage);
    }
  );
});
