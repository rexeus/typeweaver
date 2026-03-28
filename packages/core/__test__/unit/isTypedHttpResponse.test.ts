import { describe, expect, test } from "vitest";
import { isTypedHttpResponse } from "../../src/HttpResponse";

describe("isTypedHttpResponse", () => {
  test("returns false for null", () => {
    expect(isTypedHttpResponse(null)).toBe(false);
  });

  test("returns false for undefined", () => {
    expect(isTypedHttpResponse(undefined)).toBe(false);
  });

  test("returns false for a number", () => {
    expect(isTypedHttpResponse(42)).toBe(false);
  });

  test("returns false for a string", () => {
    expect(isTypedHttpResponse("hello")).toBe(false);
  });

  test("returns false for a boolean", () => {
    expect(isTypedHttpResponse(true)).toBe(false);
  });

  test("returns false for an empty object", () => {
    expect(isTypedHttpResponse({})).toBe(false);
  });

  test("returns false when type is not a string", () => {
    expect(isTypedHttpResponse({ type: 123, statusCode: 200 })).toBe(false);
  });

  test("returns false when statusCode is missing", () => {
    expect(isTypedHttpResponse({ type: "Foo" })).toBe(false);
  });

  test("returns false when type is missing", () => {
    expect(isTypedHttpResponse({ statusCode: 200 })).toBe(false);
  });

  test("returns false when statusCode is a string", () => {
    expect(isTypedHttpResponse({ type: "Success", statusCode: "200" })).toBe(
      false
    );
  });

  test("returns false for an array", () => {
    expect(isTypedHttpResponse([])).toBe(false);
  });

  test("returns true for a minimal valid typed response", () => {
    expect(isTypedHttpResponse({ type: "Success", statusCode: 200 })).toBe(
      true
    );
  });

  test("returns true for a typed response with body", () => {
    expect(
      isTypedHttpResponse({
        type: "Error",
        statusCode: 500,
        body: { message: "fail" },
      })
    ).toBe(true);
  });

  test("returns true for a typed response with header", () => {
    expect(
      isTypedHttpResponse({
        type: "NoContent",
        statusCode: 204,
        header: { "Content-Type": "application/json" },
      })
    ).toBe(true);
  });
});
