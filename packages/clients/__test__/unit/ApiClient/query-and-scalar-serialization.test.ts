import type { ClientHttpQuery } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import {
  expectRequestSerializationFailure,
  getFetchCall,
  sendRaw,
} from "./fixtures.js";

describe("ApiClient query string construction", () => {
  test("appends scalar query values", async () => {
    const { mockFetch } = await sendRaw({
      path: "/todos",
      query: { status: "TODO", page: "2" },
    });

    expect(getFetchCall(mockFetch).url).toBe(
      "http://localhost:3000/todos?status=TODO&page=2"
    );
  });

  test("repeats array query keys in order", async () => {
    const { mockFetch } = await sendRaw({
      path: "/todos",
      query: { tag: ["api", "client"] },
    });

    expect(getFetchCall(mockFetch).url).toBe(
      "http://localhost:3000/todos?tag=api&tag=client"
    );
  });

  test("skips undefined scalar values and undefined array items", async () => {
    const query = {
      status: "TODO",
      priority: undefined,
      tag: ["api", undefined, "client"],
    } as unknown as ClientHttpQuery;

    const { mockFetch } = await sendRaw({ path: "/todos", query });

    expect(getFetchCall(mockFetch).url).toBe(
      "http://localhost:3000/todos?status=TODO&tag=api&tag=client"
    );
  });

  test("encodes special characters, spaces, and unicode through URLSearchParams", async () => {
    const { mockFetch } = await sendRaw({
      path: "/search",
      query: { q: "hello world/ä+?", marker: "#☃" },
    });

    expect(getFetchCall(mockFetch).url).toBe(
      "http://localhost:3000/search?q=hello+world%2F%C3%A4%2B%3F&marker=%23%E2%98%83"
    );
  });

  test("omits trailing question mark when query is absent", async () => {
    const { mockFetch } = await sendRaw({ path: "/todos" });

    expect(getFetchCall(mockFetch).url).toBe("http://localhost:3000/todos");
  });

  test("rejects an empty query array before fetch", async () => {
    await expectRequestSerializationFailure(
      {
        path: "/todos",
        query: { emptyTags: [] } as unknown as ClientHttpQuery,
      },
      {
        location: "query",
        key: "emptyTags",
        reason: "empty-array",
        valueType: "array",
      }
    );
  });

  test("omits trailing question mark when all query values are undefined", async () => {
    const query = {
      priority: undefined,
      skippedTags: [undefined, undefined],
    } as unknown as ClientHttpQuery;

    const { mockFetch } = await sendRaw({ path: "/todos", query });

    expect(getFetchCall(mockFetch).url).toBe("http://localhost:3000/todos");
  });

  test("merges default query values while request values take precedence", async () => {
    const { mockFetch } = await sendRaw(
      {
        path: "/todos",
        query: { page: "2", filter: "open" },
      },
      {
        defaultQuery: { apiKey: "secret", page: "1" },
      }
    );

    expect(getFetchCall(mockFetch).url).toBe(
      "http://localhost:3000/todos?apiKey=secret&page=2&filter=open"
    );
  });
});

describe("ApiClient typed HTTP scalar serialization", () => {
  test("serializes domain scalars consistently across path, query, and headers", async () => {
    const capturedAt = new Date("2026-07-26T10:15:30.000Z");
    const { mockFetch } = await sendRaw({
      path: "/metrics/:metricId",
      param: { metricId: 42 },
      query: {
        enabled: false,
        count: 7,
        sequence: 9007199254740993n,
        capturedAt,
        samples: [1.5, 2, true, 3n, capturedAt],
        omitted: undefined,
      },
      header: {
        "X-Attempt": 3,
        "X-Enabled": false,
        "X-Sequence": 9007199254740993n,
        "X-Observed-At": capturedAt,
        "X-Values": [1, false, 2n, capturedAt],
        "X-Omitted": undefined,
      },
    });

    const { url, init } = getFetchCall(mockFetch);
    const parsedUrl = new URL(url);

    expect(parsedUrl.pathname).toBe("/metrics/42");
    expect([...parsedUrl.searchParams.entries()]).toEqual([
      ["enabled", "false"],
      ["count", "7"],
      ["sequence", "9007199254740993"],
      ["capturedAt", "2026-07-26T10:15:30.000Z"],
      ["samples", "1.5"],
      ["samples", "2"],
      ["samples", "true"],
      ["samples", "3"],
      ["samples", "2026-07-26T10:15:30.000Z"],
    ]);
    expect(init.headers).toStrictEqual({
      "X-Attempt": "3",
      "X-Enabled": "false",
      "X-Observed-At": "2026-07-26T10:15:30.000Z",
      "X-Sequence": "9007199254740993",
      "X-Values": "1, false, 2, 2026-07-26T10:15:30.000Z",
    });
  });
});

describe("ApiClient invalid scalar serialization", () => {
  test.each([
    {
      case: "NaN query value",
      command: {
        query: { limit: Number.NaN },
      },
      expected: {
        location: "query",
        key: "limit",
        reason: "non-finite-number",
        valueType: "number",
      },
    },
    {
      case: "infinite header value",
      command: {
        header: { "X-Limit": Number.POSITIVE_INFINITY },
      },
      expected: {
        location: "header",
        key: "X-Limit",
        reason: "non-finite-number",
        valueType: "number",
      },
    },
    {
      case: "negative infinite query value",
      command: {
        query: { limit: Number.NEGATIVE_INFINITY },
      },
      expected: {
        location: "query",
        key: "limit",
        reason: "non-finite-number",
        valueType: "number",
      },
    },
    {
      case: "invalid Date path value",
      command: {
        path: "/metrics/:metricId",
        param: { metricId: new Date(Number.NaN) },
      },
      expected: {
        location: "path",
        key: "metricId",
        reason: "invalid-date",
        valueType: "Date",
      },
    },
  ])("rejects $case before fetch", async ({ command, expected }) => {
    await expectRequestSerializationFailure(command, expected);
  });
});
