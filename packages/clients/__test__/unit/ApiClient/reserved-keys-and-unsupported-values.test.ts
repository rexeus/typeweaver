import type {
  ClientHttpHeader,
  ClientHttpParam,
  ClientHttpQuery,
} from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import {
  expectRequestSerializationFailure,
  getFetchCall,
  sendRaw,
} from "./fixtures.js";

describe("ApiClient reserved record keys", () => {
  const withOwnProtoKey = <TValue>(value: TValue): Record<string, TValue> => {
    const record: Record<string, TValue> = {};
    Object.defineProperty(record, "__proto__", {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    return record;
  };

  test("rejects an own __proto__ query key before fetch", async () => {
    await expectRequestSerializationFailure(
      { query: withOwnProtoKey("value") },
      {
        location: "query",
        key: "__proto__",
        reason: "reserved-key",
        valueType: "string",
      }
    );
  });

  test("rejects an own __proto__ header key before fetch", async () => {
    await expectRequestSerializationFailure(
      { header: withOwnProtoKey("value") },
      {
        location: "header",
        key: "__proto__",
        reason: "reserved-key",
        valueType: "string",
      }
    );
  });

  test("rejects an own __proto__ path parameter before fetch", async () => {
    await expectRequestSerializationFailure(
      { path: "/todos/:todoId", param: withOwnProtoKey("value") },
      {
        location: "path",
        key: "__proto__",
        reason: "reserved-key",
        valueType: "string",
      }
    );
  });

  test("serializes ordinary embedded path placeholders", async () => {
    const { mockFetch } = await sendRaw({
      path: "/files/:fileId.:format",
      param: { fileId: "report", format: "json" },
    });

    expect(getFetchCall(mockFetch).url).toBe(
      "http://localhost:3000/files/report.json"
    );
  });

  test("escapes embedded delimiters inside path parameter values", async () => {
    const { mockFetch } = await sendRaw({
      path: "/files/:fileId.:format",
      param: { fileId: "quarter.1", format: "json" },
    });

    expect(getFetchCall(mockFetch).url).toBe(
      "http://localhost:3000/files/quarter%2E1.json"
    );
  });

  test("serializes constructor and toString path parameters", async () => {
    const { mockFetch } = await sendRaw({
      path: "/todos/:constructor/:toString",
      param: { constructor: "a", toString: "b" },
    });

    expect(getFetchCall(mockFetch).url).toBe("http://localhost:3000/todos/a/b");
  });

  test("serializes constructor and toString query and header keys", async () => {
    const query: Record<string, string> = {
      constructor: "c",
      toString: "t",
    };
    const header: Record<string, string> = {
      constructor: "c",
      toString: "t",
    };

    const { mockFetch } = await sendRaw({ query, header });
    const call = getFetchCall(mockFetch);

    expect(call.url).toContain("constructor=c");
    expect(call.url).toContain("toString=t");
    expect(call.init.headers).toMatchObject({
      constructor: "c",
      toString: "t",
    });
  });
});

describe("ApiClient unsupported value serialization", () => {
  test.each([
    {
      case: "null query value",
      command: {
        query: { filter: null } as unknown as ClientHttpQuery,
      },
      expected: {
        location: "query",
        key: "filter",
        reason: "null-value",
        valueType: "null",
      },
    },
    {
      case: "nested query array",
      command: {
        query: { filters: [["nested"]] } as unknown as ClientHttpQuery,
      },
      expected: {
        location: "query",
        key: "filters",
        reason: "nested-array",
        valueType: "array",
      },
    },
    {
      case: "object query value",
      command: {
        query: { filter: { status: "open" } } as unknown as ClientHttpQuery,
      },
      expected: {
        location: "query",
        key: "filter",
        reason: "unsupported-type",
        valueType: "object",
      },
    },
    {
      case: "function header value",
      command: {
        header: { "X-Value": () => "value" } as unknown as ClientHttpHeader,
      },
      expected: {
        location: "header",
        key: "X-Value",
        reason: "unsupported-type",
        valueType: "function",
      },
    },
    {
      case: "symbol path value",
      command: {
        path: "/metrics/:metricId",
        param: {
          metricId: Symbol("metric"),
        } as unknown as ClientHttpParam,
      },
      expected: {
        location: "path",
        key: "metricId",
        reason: "unsupported-type",
        valueType: "symbol",
      },
    },
  ])("rejects $case before fetch", async ({ command, expected }) => {
    await expectRequestSerializationFailure(command, expected);
  });
});
