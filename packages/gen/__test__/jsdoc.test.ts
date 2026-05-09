import { describe, expect, test } from "vitest";
import { createJSDocComment } from "../src/index.js";

describe("createJSDocComment", () => {
  test.each([
    { case: "undefined", text: undefined },
    { case: "empty", text: "" },
    { case: "blank", text: " \t\n\r\n " },
  ])("returns undefined for $case input", ({ text }) => {
    const comment = createJSDocComment(text);

    expect(comment).toBeUndefined();
  });

  test("formats single-line text as a JSDoc block", () => {
    const comment = createJSDocComment("Create a todo");

    expect(comment).toBe("/**\n * Create a todo\n */");
  });

  test("preserves internal multiline formatting while trimming outer blank lines", () => {
    const comment = createJSDocComment(
      "\r\nFirst line\r\n\r\n  Indented line\r\n"
    );

    expect(comment).toBe("/**\n * First line\n * \n *   Indented line\n */");
  });

  test("applies indentation before each emitted line", () => {
    const comment = createJSDocComment("Indented", { indentation: "  " });

    expect(comment).toBe("  /**\n   * Indented\n   */");
  });

  test("sanitizes block comment terminators", () => {
    const comment = createJSDocComment("Do not close */ the comment");

    expect(comment).toBe("/**\n * Do not close *\\/ the comment\n */");
  });
});
