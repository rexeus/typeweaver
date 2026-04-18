import { describe, expect, test, vi } from "vitest";
import { fail, pass, warn } from "../src/pipeline/helpers.js";
import {
  assertKnownDependencies,
  runChecks,
  summarizeChecks,
} from "../src/pipeline/runner.js";
import type {
  BaseCheckResult,
  Check,
  CheckContext,
} from "../src/pipeline/types.js";

type TestState = {
  value: number;
};

type TestContext = CheckContext<TestState>;
type TestCheck = Check<TestState, BaseCheckResult, TestContext>;

const createContext = (initialValue = 0): TestContext => ({
  state: { value: initialValue },
});

const createResult = (status: BaseCheckResult["status"]): BaseCheckResult => ({
  id: status,
  label: status,
  status,
  summary: status,
  details: [],
});

describe("runChecks", () => {
  test("preserves the order of results and forwards check statuses", async () => {
    const alpha: TestCheck = {
      id: "alpha",
      label: "Alpha",
      run: async () => pass({ id: "alpha", label: "Alpha" }, "ok"),
    };
    const beta: TestCheck = {
      id: "beta",
      label: "Beta",
      run: async () => warn({ id: "beta", label: "Beta" }, "meh"),
    };

    const results = await runChecks([alpha, beta], createContext());

    expect(results.map(r => r.id)).toEqual(["alpha", "beta"]);
    expect(results[0]?.status).toBe("pass");
    expect(results[1]?.status).toBe("warn");
  });

  test("skips dependent checks when a blocking prerequisite fails", async () => {
    const failing: TestCheck = {
      id: "root",
      label: "Root",
      run: async () => fail({ id: "root", label: "Root" }, "broken"),
    };
    const dependent: TestCheck = {
      id: "leaf",
      label: "Leaf",
      dependsOn: ["root"],
      run: vi.fn(),
    };

    const results = await runChecks([failing, dependent], createContext());

    expect(results[1]).toEqual(
      expect.objectContaining({
        id: "leaf",
        status: "skip",
        summary: expect.stringContaining("'Root'"),
      })
    );
    expect(dependent.run).not.toHaveBeenCalled();
  });

  test("skips dependents transitively when a prerequisite was skipped", async () => {
    const failing: TestCheck = {
      id: "root",
      label: "Root",
      run: async () => fail({ id: "root", label: "Root" }, "broken"),
    };
    const middle: TestCheck = {
      id: "middle",
      label: "Middle",
      dependsOn: ["root"],
      run: vi.fn(),
    };
    const leaf: TestCheck = {
      id: "leaf",
      label: "Leaf",
      dependsOn: ["middle"],
      run: vi.fn(),
    };

    const results = await runChecks([failing, middle, leaf], createContext());

    expect(results[1]?.status).toBe("skip");
    expect(results[2]).toEqual(
      expect.objectContaining({
        id: "leaf",
        status: "skip",
        summary: expect.stringContaining("'Middle'"),
      })
    );
    expect(middle.run).not.toHaveBeenCalled();
    expect(leaf.run).not.toHaveBeenCalled();
  });

  test("treats dependencies outside the run as non-blocking", async () => {
    const isolated: TestCheck = {
      id: "leaf",
      label: "Leaf",
      dependsOn: ["not-in-this-run"],
      run: async () => pass({ id: "leaf", label: "Leaf" }, "ok"),
    };

    const results = await runChecks([isolated], createContext());

    expect(results[0]?.status).toBe("pass");
  });

  test("does not block dependents when a prerequisite warns", async () => {
    const warning: TestCheck = {
      id: "root",
      label: "Root",
      run: async () => warn({ id: "root", label: "Root" }, "meh"),
    };
    const dependent: TestCheck = {
      id: "leaf",
      label: "Leaf",
      dependsOn: ["root"],
      run: vi.fn(async () => pass({ id: "leaf", label: "Leaf" }, "ok")),
    };

    const results = await runChecks([warning, dependent], createContext());

    expect(results[1]?.status).toBe("pass");
    expect(dependent.run).toHaveBeenCalledTimes(1);
  });

  test("merges outcome state into the shared context", async () => {
    const context = createContext(1);

    const incrementer: TestCheck = {
      id: "inc",
      label: "Inc",
      run: async () =>
        pass({ id: "inc", label: "Inc" }, "ok", { state: { value: 2 } }),
    };
    const reader: TestCheck = {
      id: "read",
      label: "Read",
      run: async ctx =>
        pass(
          { id: "read", label: "Read" },
          `value=${ctx.state.value.toString()}`
        ),
    };

    const results = await runChecks([incrementer, reader], context);

    expect(context.state.value).toBe(2);
    expect(results[1]?.summary).toBe("value=2");
  });

  test("captures thrown errors and converts them into fail results", async () => {
    const exploding: TestCheck = {
      id: "boom",
      label: "Boom",
      run: async () => {
        throw new Error("kaboom");
      },
    };

    const results = await runChecks([exploding], createContext());

    expect(results[0]).toEqual(
      expect.objectContaining({
        id: "boom",
        status: "fail",
        summary: expect.stringContaining("kaboom"),
      })
    );
  });
});

describe("assertKnownDependencies", () => {
  test("accepts a check set where every dependency is declared", () => {
    const root: TestCheck = {
      id: "root",
      label: "Root",
      run: async () => pass({ id: "root", label: "Root" }, "ok"),
    };
    const leaf: TestCheck = {
      id: "leaf",
      label: "Leaf",
      dependsOn: ["root"],
      run: async () => pass({ id: "leaf", label: "Leaf" }, "ok"),
    };

    expect(() => assertKnownDependencies([root, leaf])).not.toThrow();
  });

  test("throws when a check references a dependency missing from the set", () => {
    const orphan: TestCheck = {
      id: "orphan",
      label: "Orphan",
      dependsOn: ["typoed"],
      run: async () => pass({ id: "orphan", label: "Orphan" }, "ok"),
    };

    expect(() => assertKnownDependencies([orphan])).toThrow(
      /'orphan' declares unknown dependency 'typoed'/
    );
  });
});

describe("summarizeChecks", () => {
  test("counts each status bucket and flags failures", () => {
    const summary = summarizeChecks([
      createResult("pass"),
      createResult("warn"),
      createResult("fail"),
      createResult("skip"),
      createResult("pass"),
    ]);

    expect(summary).toEqual({
      totalChecks: 5,
      passedChecks: 2,
      warnedChecks: 1,
      failedChecks: 1,
      skippedChecks: 1,
      hasFailures: true,
    });
  });

  test("reports no failures for an all-pass run", () => {
    const summary = summarizeChecks([
      createResult("pass"),
      createResult("pass"),
    ]);

    expect(summary.hasFailures).toBe(false);
    expect(summary.failedChecks).toBe(0);
  });
});
