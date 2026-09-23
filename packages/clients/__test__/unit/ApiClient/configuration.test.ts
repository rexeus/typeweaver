import { HttpMethod } from "@rexeus/typeweaver-core";
import { captureError, TestAssertionError } from "test-utils";
import { describe, expect, test } from "vitest";
import { ApiClientConfigurationError } from "../../../src/lib/errors/ApiClientConfigurationError.js";
import {
  createClient,
  getFetchCall,
  resolvedFetch,
  TestApiClient,
  TestRequestCommand,
} from "./fixtures.js";
import type { ApiClientProps } from "../../../src/lib/ApiClient.js";

function captureApiClientConfigurationError(
  action: () => void
): ApiClientConfigurationError {
  const error = captureError(action);

  if (!(error instanceof ApiClientConfigurationError)) {
    throw new TestAssertionError(
      "Expected ApiClientConfigurationError to be thrown"
    );
  }

  return error;
}

describe("ApiClient constructor", () => {
  test.each([
    { case: "HTTP absolute base URL", baseUrl: "http://localhost:3000" },
    { case: "HTTPS absolute base URL", baseUrl: "https://api.example.com" },
    {
      case: "mixed-case HTTP absolute base URL",
      baseUrl: "HTTP://localhost:3000",
    },
    {
      case: "mixed-case HTTPS absolute base URL",
      baseUrl: "HtTpS://api.example.com",
    },
    { case: "relative base path", baseUrl: "/api" },
    { case: "relative base path with colon", baseUrl: "/api:v1" },
    { case: "relative base path without leading slash", baseUrl: "api" },
  ])("accepts $case", ({ baseUrl }) => {
    expect(() => createClient(resolvedFetch(), { baseUrl })).not.toThrow();
  });

  test.each([
    { case: "FTP", baseUrl: "ftp://api.example.com" },
    { case: "file", baseUrl: "file:///tmp/api" },
    { case: "mailto", baseUrl: "mailto:user@example.com" },
    { case: "javascript", baseUrl: "javascript:alert(1)" },
    { case: "data", baseUrl: "data:text/plain,hello" },
  ])("rejects absolute non-http(s) $case baseUrl", ({ baseUrl }) => {
    const error = captureApiClientConfigurationError(() =>
      createClient(resolvedFetch(), { baseUrl })
    );

    expect(error).toEqual(
      expect.objectContaining({
        baseUrl,
        field: "baseUrl",
        reason: "unsupported-base-url-scheme",
        scheme: baseUrl.split(":", 1)[0]?.toLowerCase(),
      })
    );
  });

  test.each([
    {
      case: "newline inserted into a javascript scheme",
      baseUrl: "java\nscript:alert(1)",
    },
    {
      case: "leading tab before a data scheme",
      baseUrl: "\tdata:text/plain,hello",
    },
    {
      case: "carriage return inserted after an FTP scheme",
      baseUrl: "ftp:\r//api.example.com",
    },
    {
      case: "malformed HTTP absolute URL",
      baseUrl: "http://%",
    },
  ])("rejects $case baseUrl", ({ baseUrl }) => {
    const error = captureApiClientConfigurationError(() =>
      createClient(resolvedFetch(), { baseUrl })
    );

    expect(error).toEqual(
      expect.objectContaining({
        baseUrl,
        field: "baseUrl",
        reason: "malformed-base-url",
      })
    );
  });
});

describe("ApiClient base URL validation", () => {
  test("classifies a malformed absolute URL with a visible scheme as malformed", () => {
    const error = captureApiClientConfigurationError(() =>
      createClient(resolvedFetch(), { baseUrl: "ftp://%" })
    );

    expect(error).toEqual(
      expect.objectContaining({
        baseUrl: "ftp://%",
        field: "baseUrl",
        reason: "malformed-base-url",
        scheme: "ftp",
      })
    );
  });

  test("classifies a relative base URL with ASCII control characters as malformed", () => {
    const baseUrl = "/api\nv1";

    const error = captureApiClientConfigurationError(() =>
      createClient(resolvedFetch(), { baseUrl })
    );

    expect(error).toEqual(
      expect.objectContaining({
        baseUrl,
        field: "baseUrl",
        reason: "malformed-base-url",
      })
    );
  });

  test.each([
    { case: "empty", baseUrl: "" },
    { case: "whitespace-only", baseUrl: "   \t\n" },
  ])("rejects $case baseUrl", ({ baseUrl }) => {
    const error = captureApiClientConfigurationError(() =>
      createClient(resolvedFetch(), { baseUrl })
    );

    expect(error).toEqual(
      expect.objectContaining({
        baseUrl,
        field: "baseUrl",
        reason: "missing-base-url",
      })
    );
  });
});

describe("ApiClient option validation", () => {
  test("rejects a missing baseUrl with the validation error", () => {
    const props = { fetchFn: resolvedFetch() } as unknown as ApiClientProps;

    const error = captureApiClientConfigurationError(
      () => new TestApiClient(props)
    );

    expect(error).toEqual(
      expect.objectContaining({
        field: "baseUrl",
        reason: "missing-base-url",
      })
    );
  });

  test("rejects a non-string baseUrl with the validation error", () => {
    const props = {
      baseUrl: 123 as unknown as string,
      fetchFn: resolvedFetch(),
    } satisfies ApiClientProps;

    const error = captureApiClientConfigurationError(
      () => new TestApiClient(props)
    );

    expect(error).toEqual(
      expect.objectContaining({
        baseUrl: props.baseUrl,
        field: "baseUrl",
        reason: "missing-base-url",
      })
    );
  });

  test.each([
    { case: "zero", timeoutMs: 0 },
    { case: "negative", timeoutMs: -1 },
    { case: "NaN", timeoutMs: Number.NaN },
    { case: "Infinity", timeoutMs: Infinity },
  ])("rejects $case timeoutMs", ({ timeoutMs }) => {
    const error = captureApiClientConfigurationError(() =>
      createClient(resolvedFetch(), { timeoutMs })
    );

    expect(error).toEqual(
      expect.objectContaining({
        field: "timeoutMs",
        reason: "invalid-timeout",
        timeoutMs,
      })
    );
  });

  test("accepts positive timeoutMs", () => {
    expect(() => createClient(resolvedFetch(), { timeoutMs: 1 })).not.toThrow();
  });

  test("uses global fetch when fetchFn is omitted", async () => {
    const originalFetch = globalThis.fetch;
    const globalFetch = resolvedFetch(new Response(null, { status: 204 }));
    globalThis.fetch = globalFetch;

    try {
      const client = new TestApiClient({ baseUrl: "http://localhost:3000" });

      await client.send(new TestRequestCommand({ method: HttpMethod.DELETE }));

      const call = getFetchCall(globalFetch);
      expect(call.url).toBe("http://localhost:3000/todos");
      expect(call.init).toMatchObject({ method: HttpMethod.DELETE });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
