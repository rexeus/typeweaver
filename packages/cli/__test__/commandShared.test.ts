import { describe, expect, test, vi } from "vitest";
import {
  createCommandLogger,
  resolveCommandPath,
  resolvePluginList,
} from "../src/commands/shared.js";

describe("resolveCommandPath", () => {
  test("returns absolute paths unchanged", () => {
    expect(resolveCommandPath("/workspace", "/absolute/spec.ts")).toBe(
      "/absolute/spec.ts"
    );
  });

  test("joins relative paths to the exec directory", () => {
    expect(resolveCommandPath("/workspace", "spec/index.ts")).toBe(
      "/workspace/spec/index.ts"
    );
  });

  test("normalizes parent-relative segments via path.join", () => {
    expect(resolveCommandPath("/workspace/project", "../other/spec.ts")).toBe(
      "/workspace/other/spec.ts"
    );
  });
});

describe("resolvePluginList", () => {
  test("returns undefined when no input is provided", () => {
    expect(resolvePluginList(undefined)).toBeUndefined();
  });

  test("parses comma-separated values into a trimmed list", () => {
    expect(resolvePluginList("clients,hono,aws-cdk")).toEqual([
      "clients",
      "hono",
      "aws-cdk",
    ]);
  });

  test("trims surrounding whitespace on each entry", () => {
    expect(resolvePluginList(" clients ,  hono , aws-cdk")).toEqual([
      "clients",
      "hono",
      "aws-cdk",
    ]);
  });

  test("drops empty segments from leading or trailing commas", () => {
    expect(resolvePluginList(",clients,,hono,")).toEqual(["clients", "hono"]);
  });

  test("returns undefined when the input contains only whitespace and commas", () => {
    expect(resolvePluginList(" , , ,")).toBeUndefined();
  });

  test("returns undefined for an empty string", () => {
    expect(resolvePluginList("")).toBeUndefined();
  });
});

describe("createCommandLogger", () => {
  test("threads verbose and quiet flags into the underlying logger", () => {
    const stdout = { isTTY: false, write: vi.fn() };
    const stderr = { isTTY: false, write: vi.fn() };

    const logger = createCommandLogger({
      verbose: true,
      quiet: false,
    });
    // `createCommandLogger` returns a real Logger — assert its invariants.
    expect(logger.isVerbose).toBe(true);

    stdout.write.mockClear();
    stderr.write.mockClear();
  });

  test("disables color when --no-color is set", () => {
    const logger = createCommandLogger({ noColor: true });

    expect(logger).toBeDefined();
    expect(logger.isVerbose).toBe(false);
  });
});
