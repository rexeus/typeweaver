import { describe, expect, test } from "vitest";
import { isReservedKeyword, RESERVED_KEYWORDS } from "../src/reserved-keywords";

describe("isReservedKeyword", () => {
  test.each([
    "break",
    "case",
    "catch",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "finally",
    "for",
    "function",
    "if",
    "in",
    "instanceof",
    "new",
    "return",
    "switch",
    "this",
    "throw",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
    "class",
    "const",
    "enum",
    "export",
    "extends",
    "import",
    "super",
    "implements",
    "interface",
    "let",
    "package",
    "private",
    "protected",
    "public",
    "static",
    "yield",
    "abstract",
    "declare",
    "is",
    "module",
    "namespace",
    "require",
    "type",
    "constructor",
    "prototype",
    "__proto__",
    "arguments",
    "eval",
  ])("returns true for reserved keyword '%s'", keyword => {
    expect(isReservedKeyword(keyword)).toBe(true);
  });

  test.each([
    "deleteTodo",
    "Delete",
    "myClass",
    "className",
    "newItem",
    "getValue",
    "forEach",
    "toString",
    "async",
    "await",
    "get",
    "set",
    "of",
    "as",
    "from",
    "todoId",
    "user",
    "account",
  ])("returns false for valid identifier '%s'", identifier => {
    expect(isReservedKeyword(identifier)).toBe(false);
  });

  test("is case-sensitive", () => {
    expect(isReservedKeyword("delete")).toBe(true);
    expect(isReservedKeyword("Delete")).toBe(false);
    expect(isReservedKeyword("DELETE")).toBe(false);
    expect(isReservedKeyword("class")).toBe(true);
    expect(isReservedKeyword("Class")).toBe(false);
  });

  test("RESERVED_KEYWORDS set is non-empty", () => {
    expect(RESERVED_KEYWORDS.size).toBeGreaterThan(0);
  });
});
