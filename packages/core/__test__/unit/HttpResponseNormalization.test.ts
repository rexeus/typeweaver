import { describe, expect, test } from "vitest";
import {
  HttpStatusCode,
  isTypedHttpResponse,
  normalizeHttpResponse,
  toHttpHeader,
  toHttpResponse,
} from "../../src/index.js";
import type { IHttpResponse, ITypedHttpResponse } from "../../src/index.js";

const aTypedResponseWith = (
  overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
  type: "Created",
  statusCode: HttpStatusCode.CREATED,
  body: { id: "todo-1" },
  ...overrides,
});

const aNullPrototypeRecordWith = (
  properties: Record<string, unknown>
): Record<string, unknown> => Object.assign(Object.create(null), properties);

describe("HTTP response normalization", () => {
  describe("typed response detection", () => {
    test.each([
      { case: "null", candidate: null },
      { case: "array", candidate: [] },
      {
        case: "object missing type",
        candidate: { statusCode: HttpStatusCode.CREATED },
      },
      {
        case: "object with non-string type",
        candidate: aTypedResponseWith({ type: 1 }),
      },
      {
        case: "object missing statusCode",
        candidate: { type: "Created" },
      },
      {
        case: "object with unregistered numeric status",
        candidate: aTypedResponseWith({ statusCode: 599 }),
      },
      {
        case: "object with string status",
        candidate: aTypedResponseWith({ statusCode: "201" }),
      },
    ])("rejects malformed candidates: $case", ({ candidate }) => {
      const isTypedResponse = isTypedHttpResponse(candidate);

      expect(isTypedResponse).toBe(false);
    });

    test.each([
      {
        case: "without a header property",
        candidate: aTypedResponseWith(),
      },
      {
        case: "with an undefined header",
        candidate: aTypedResponseWith({ header: undefined }),
      },
      {
        case: "with a string header value",
        candidate: aTypedResponseWith({ header: { "X-Request-Id": "req-1" } }),
      },
      {
        case: "with a string-array header value",
        candidate: aTypedResponseWith({
          header: { "Set-Cookie": ["session=abc", "theme=dark"] },
        }),
      },
      {
        case: "with null-prototype response and header objects",
        candidate: aNullPrototypeRecordWith({
          type: "Created",
          statusCode: HttpStatusCode.CREATED,
          header: aNullPrototypeRecordWith({ "X-Request-Id": "req-1" }),
          body: { id: "todo-1" },
        }),
      },
    ])("accepts valid typed-response variants: $case", ({ candidate }) => {
      const isTypedResponse = isTypedHttpResponse(candidate);

      expect(isTypedResponse).toBe(true);
    });

    test.each([
      { case: "null header", header: null },
      { case: "array header", header: [] },
      { case: "number-valued header", header: { "X-Retry": 1 } },
      {
        case: "header array containing a non-string item",
        header: { "Set-Cookie": ["session=abc", 1] },
      },
    ])("rejects invalid header shapes: $case", ({ header }) => {
      const candidate = aTypedResponseWith({ header });

      const isTypedResponse = isTypedHttpResponse(candidate);

      expect(isTypedResponse).toBe(false);
    });
  });

  test("removes undefined typed response headers when converting to an HTTP response", () => {
    const response = {
      type: "Created",
      statusCode: HttpStatusCode.CREATED,
      header: {
        "X-Request-Id": "request-1",
        "X-Optional": undefined,
      },
      body: { id: "todo-1" },
    } satisfies ITypedHttpResponse;

    const normalized = toHttpResponse(response);

    expect(normalized).toEqual({
      statusCode: HttpStatusCode.CREATED,
      header: { "X-Request-Id": "request-1" },
      body: { id: "todo-1" },
    });
  });

  test("omits normalized headers when every typed header value is undefined", () => {
    const header = {
      "X-Optional": undefined,
    } satisfies ITypedHttpResponse["header"];

    const normalized = toHttpHeader(header);

    expect(normalized).toBeUndefined();
  });

  test("preserves defined string-array and empty-string headers while omitting undefined headers", () => {
    const header = {
      "Set-Cookie": ["session=abc", "theme=dark"],
      "X-Empty": "",
      "X-Optional": undefined,
    } satisfies ITypedHttpResponse["header"];

    const normalized = toHttpHeader(header);

    expect(normalized).toEqual({
      "Set-Cookie": ["session=abc", "theme=dark"],
      "X-Empty": "",
    });
  });

  test("normalizes typed HTTP responses imported from the root package", () => {
    const response = {
      type: "NoContent",
      statusCode: HttpStatusCode.NO_CONTENT,
      header: undefined,
      body: undefined,
    } satisfies ITypedHttpResponse;

    const normalized = normalizeHttpResponse(response);

    expect(normalized).toEqual({
      statusCode: HttpStatusCode.NO_CONTENT,
      header: undefined,
      body: undefined,
    });
  });

  test("preserves plain HTTP responses during normalization", () => {
    const response = {
      statusCode: HttpStatusCode.OK,
      header: { "X-Request-Id": "request-1" },
      body: { ok: true },
    } satisfies IHttpResponse;

    const normalized = normalizeHttpResponse(response);

    expect(normalized).toBe(response);
  });
});
