import { describe, expect, test } from "vitest";
import {
  DEFAULT_MAX_BODY_SIZE,
  createFetchBodyLimitPolicy,
  createNodeBodyLimitPolicy,
  getRequestBodyPrevalidation,
  hasSatisfiedBodyLimitPolicy,
  isBodySizeOverLimit,
  markRequestBodyPrevalidated,
  parseContentLength,
  resolveMaxBodySize,
} from "../../src/lib/BodyLimitPolicy.js";

function aPostRequest(): Request {
  return new Request("http://localhost/items", {
    method: "POST",
    body: "hello",
  });
}

describe("BodyLimitPolicy", () => {
  test("creates a fetch policy with the default limit", () => {
    expect(createFetchBodyLimitPolicy()).toEqual({
      maxBodySize: DEFAULT_MAX_BODY_SIZE,
      capability: "unvalidated-request-body",
    });
  });

  test("creates a fetch policy with the provided limit", () => {
    expect(createFetchBodyLimitPolicy(128)).toEqual({
      maxBodySize: 128,
      capability: "unvalidated-request-body",
    });
  });

  test("creates a node policy with the default limit", () => {
    expect(createNodeBodyLimitPolicy()).toEqual({
      maxBodySize: DEFAULT_MAX_BODY_SIZE,
      capability: "prevalidated-request-body",
    });
  });

  test("creates a node policy with the provided limit", () => {
    expect(createNodeBodyLimitPolicy(128)).toEqual({
      maxBodySize: 128,
      capability: "prevalidated-request-body",
    });
  });

  describe("resolveMaxBodySize", () => {
    test("uses the default limit when no limit is configured", () => {
      expect(resolveMaxBodySize()).toBe(DEFAULT_MAX_BODY_SIZE);
    });

    test("uses the configured limit when a limit is provided", () => {
      expect(resolveMaxBodySize(128)).toBe(128);
    });

    test("preserves an explicit zero-byte limit", () => {
      expect(resolveMaxBodySize(0)).toBe(0);
    });
  });

  describe("parseContentLength", () => {
    test.each([
      { scenario: "undefined", value: undefined },
      { scenario: "null", value: null },
    ] as const)(
      "returns undefined for a $scenario content-length",
      ({ value }) => {
        expect(parseContentLength(value)).toBeUndefined();
      }
    );

    test("uses the first value when content-length is an array", () => {
      expect(parseContentLength(["128", "256"])).toBe(128);
    });

    test("returns undefined when content-length is an empty array", () => {
      expect(parseContentLength([])).toBeUndefined();
    });

    test("uses only the first content-length value when it is invalid", () => {
      expect(parseContentLength(["abc", "128"])).toBeUndefined();
    });

    test("parses a valid integer content-length", () => {
      expect(parseContentLength("128")).toBe(128);
    });

    test("trims whitespace around an integer content-length", () => {
      expect(parseContentLength(" 128 ")).toBe(128);
    });

    test("returns undefined for a digit-only content-length that exceeds finite numbers", () => {
      expect(parseContentLength("9".repeat(400))).toBeUndefined();
    });

    test.each([
      { scenario: "invalid", value: "abc" },
      { scenario: "negative", value: "-1" },
      { scenario: "decimal", value: "10.5" },
      { scenario: "exponent", value: "1e3" },
      { scenario: "hex-like", value: "0x10" },
      { scenario: "empty", value: "" },
      { scenario: "whitespace-only", value: "   " },
      { scenario: "NaN", value: "NaN" },
      { scenario: "non-finite", value: "Infinity" },
    ] as const)(
      "returns undefined for a $scenario content-length",
      ({ value }) => {
        expect(parseContentLength(value)).toBeUndefined();
      }
    );
  });

  describe("isBodySizeOverLimit", () => {
    test("keeps a body below the limit within policy", () => {
      expect(isBodySizeOverLimit(63, 64)).toBe(false);
    });

    test("keeps a body exactly at the limit within policy", () => {
      expect(isBodySizeOverLimit(64, 64)).toBe(false);
    });

    test("rejects a body one byte over the limit", () => {
      expect(isBodySizeOverLimit(65, 64)).toBe(true);
    });
  });

  test("marks request prevalidation for prevalidated policies", () => {
    const request = aPostRequest();
    const policy = createNodeBodyLimitPolicy(64);

    markRequestBodyPrevalidated(request, policy);

    expect(getRequestBodyPrevalidation(request)).toEqual({
      maxBodySize: 64,
    });
  });

  test("does not mark request prevalidation for unvalidated policies", () => {
    const request = aPostRequest();

    markRequestBodyPrevalidated(request, createFetchBodyLimitPolicy(64));

    expect(getRequestBodyPrevalidation(request)).toBeUndefined();
  });

  test("requires prevalidation before treating a policy as satisfied", () => {
    const request = aPostRequest();

    expect(
      hasSatisfiedBodyLimitPolicy(request, createFetchBodyLimitPolicy(64))
    ).toBe(false);
  });

  test("accepts an equal prevalidated limit", () => {
    const request = aPostRequest();
    const policy = createNodeBodyLimitPolicy(64);

    markRequestBodyPrevalidated(request, policy);

    expect(
      hasSatisfiedBodyLimitPolicy(request, createFetchBodyLimitPolicy(64))
    ).toBe(true);
  });

  test("scopes prevalidation to the exact request instance", () => {
    const prevalidatedRequest = aPostRequest();
    const equivalentRequest = aPostRequest();

    markRequestBodyPrevalidated(
      prevalidatedRequest,
      createNodeBodyLimitPolicy(64)
    );

    expect(getRequestBodyPrevalidation(equivalentRequest)).toBeUndefined();
  });

  test("replaces the recorded prevalidation limit when a request is marked again", () => {
    const request = aPostRequest();

    markRequestBodyPrevalidated(request, createNodeBodyLimitPolicy(64));
    markRequestBodyPrevalidated(request, createNodeBodyLimitPolicy(32));

    expect(getRequestBodyPrevalidation(request)).toEqual({
      maxBodySize: 32,
    });
  });

  test("accepts a stricter prevalidated limit for a looser fetch policy", () => {
    const request = aPostRequest();

    markRequestBodyPrevalidated(request, createNodeBodyLimitPolicy(32));

    expect(
      hasSatisfiedBodyLimitPolicy(request, createFetchBodyLimitPolicy(64))
    ).toBe(true);
  });

  test("rejects a looser prevalidated limit for a stricter fetch policy", () => {
    const request = aPostRequest();

    markRequestBodyPrevalidated(request, createNodeBodyLimitPolicy(64));

    expect(
      hasSatisfiedBodyLimitPolicy(request, createFetchBodyLimitPolicy(32))
    ).toBe(false);
  });
});
