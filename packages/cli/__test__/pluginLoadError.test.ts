import { describe, expect, test } from "vitest";
import { PluginLoadError } from "../src/errors/PluginLoadError.js";

describe("PluginLoadError.message", () => {
  test("renders each attempted path with its error on its own indented line", () => {
    const error = new PluginLoadError({
      pluginName: "foo",
      attempts: [
        { path: "@rexeus/typeweaver-foo", error: "ERR_MODULE_NOT_FOUND" },
        { path: "@rexeus/foo", error: "ERR_MODULE_NOT_FOUND" },
        { path: "foo", error: "ERR_MODULE_NOT_FOUND" },
      ],
    });

    expect(error.message).toBe(
      [
        "Failed to load plugin 'foo'. Tried:",
        "  - @rexeus/typeweaver-foo: ERR_MODULE_NOT_FOUND",
        "  - @rexeus/foo: ERR_MODULE_NOT_FOUND",
        "  - foo: ERR_MODULE_NOT_FOUND",
      ].join("\n")
    );
  });

  test("preserves per-attempt error detail when each row reports a different cause", () => {
    const error = new PluginLoadError({
      pluginName: "bar",
      attempts: [
        { path: "@rexeus/typeweaver-bar", error: "ERR_MODULE_NOT_FOUND" },
        {
          path: "@rexeus/bar",
          error: "Unexpected token 'export'",
        },
      ],
    });

    expect(error.message).toBe(
      [
        "Failed to load plugin 'bar'. Tried:",
        "  - @rexeus/typeweaver-bar: ERR_MODULE_NOT_FOUND",
        "  - @rexeus/bar: Unexpected token 'export'",
      ].join("\n")
    );
  });

  test("renders a terminal-punctuated header when no attempts were made", () => {
    const error = new PluginLoadError({
      pluginName: "baz",
      attempts: [],
    });

    expect(error.message).toBe("Failed to load plugin 'baz'.");
  });
});
