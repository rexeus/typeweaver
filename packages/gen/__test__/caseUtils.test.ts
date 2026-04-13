import { describe, expect, test } from "vitest";
import { toCamelCase, toPascalCase } from "../src/helpers/caseUtils.js";

describe("caseUtils", () => {
  test("keeps camelCase and PascalCase identifiers stable", () => {
    expect(toPascalCase("getTodo")).toBe("GetTodo");
    expect(toPascalCase("GetTodo")).toBe("GetTodo");
    expect(toCamelCase("getTodo")).toBe("getTodo");
    expect(toCamelCase("GetTodo")).toBe("getTodo");
  });

  test("normalizes acronym boundaries", () => {
    expect(toPascalCase("HTTPError")).toBe("HttpError");
    expect(toCamelCase("HTTPError")).toBe("httpError");
  });

  test("normalizes separator-delimited identifiers", () => {
    expect(toPascalCase("refresh-token_response")).toBe("RefreshTokenResponse");
    expect(toCamelCase("refresh-token_response")).toBe("refreshTokenResponse");
  });

  test("handles single-character and acronym-only inputs", () => {
    expect(toPascalCase("x")).toBe("X");
    expect(toCamelCase("X")).toBe("x");
    expect(toPascalCase("URL")).toBe("Url");
    expect(toCamelCase("URL")).toBe("url");
  });

  test("keeps numeric-adjacent identifier parts readable", () => {
    expect(toPascalCase("v2Endpoint")).toBe("V2Endpoint");
    expect(toCamelCase("V2Endpoint")).toBe("v2Endpoint");
  });
});
