import assert from "node:assert";
import {
  GetMetricLabelsRequestCommand,
  GetMetricRequestCommand,
  MetricClient,
} from "test-utils";
import { afterEach, describe, expect, test, vi } from "vitest";
import { runClientCleanup } from "./clientSetup.js";

afterEach(async () => {
  await runClientCleanup();
});

describe("Generated Client typed HTTP boundary serialization", () => {
  test("accepts domain scalars and emits deterministic wire values", async () => {
    const fetchFn = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ metricId: 42, enabled: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const client = new MetricClient({
      baseUrl: "https://api.example.test",
      fetchFn,
    });
    const observedAt = new Date("2026-07-26T10:15:30.000Z");
    const command = new GetMetricRequestCommand({
      param: { metricId: 42 },
      query: {
        enabled: false,
        truthy: false,
        capturedAt: observedAt,
        samples: [1.5, 2],
      },
      header: {
        "X-Attempt": 3,
        "X-Enabled": false,
        "X-Observed-At": observedAt,
      },
    });

    const response = await client.send(command);

    expect(response.type).toBe("GetMetricSuccess");
    expect(fetchFn).toHaveBeenCalledOnce();
    const call = fetchFn.mock.calls[0];
    assert(call);
    expect(call[0]).toBe(
      "https://api.example.test/metrics/42?enabled=false&truthy=false&capturedAt=2026-07-26T10%3A15%3A30.000Z&samples=1.5&samples=2"
    );
    expect(call[1]?.headers).toEqual({
      "X-Attempt": "3",
      "X-Enabled": "false",
      "X-Observed-At": "2026-07-26T10:15:30.000Z",
    });
  });

  test("rejects an empty query array before fetch", async () => {
    const fetchFn = vi.fn<typeof globalThis.fetch>();
    const client = new MetricClient({
      baseUrl: "https://api.example.test",
      fetchFn,
    });
    const command = new GetMetricRequestCommand({
      param: { metricId: 42 },
      query: { samples: [] },
      header: { "X-Attempt": 3 },
    });

    await expect(client.send(command)).rejects.toMatchObject({
      code: "REQUEST_SERIALIZATION_ERROR",
      location: "query",
      key: "samples",
      reason: "empty-array",
      valueType: "array",
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("serializes an empty header array to an empty header value", async () => {
    const fetchFn = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ metricId: 42, enabled: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const client = new MetricClient({
      baseUrl: "https://api.example.test",
      fetchFn,
    });
    const command = new GetMetricRequestCommand({
      param: { metricId: 42 },
      query: {},
      header: { "X-Attempt": 3, "X-Flags": [] },
    });

    await client.send(command);

    expect(fetchFn).toHaveBeenCalledOnce();
    const call = fetchFn.mock.calls[0];
    assert(call);
    expect(call[1]?.headers).toEqual({
      "X-Attempt": "3",
      "X-Flags": "",
    });
  });
});

describe("Generated Client reserved record keys", () => {
  test("rejects an own __proto__ record query key before fetch", async () => {
    const fetchFn = vi.fn<typeof globalThis.fetch>();
    const client = new MetricClient({
      baseUrl: "https://api.example.test",
      fetchFn,
    });
    const query: Record<string, number> = {};
    Object.defineProperty(query, "__proto__", {
      value: 1,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    const command = new GetMetricLabelsRequestCommand({
      header: undefined,
      param: { metricId: 42 },
      query,
    });

    await expect(client.send(command)).rejects.toMatchObject({
      code: "REQUEST_SERIALIZATION_ERROR",
      location: "query",
      key: "__proto__",
      reason: "reserved-key",
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("serializes constructor and toString record query keys", async () => {
    const fetchFn = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ metricId: 42, labels: {}, flags: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const client = new MetricClient({
      baseUrl: "https://api.example.test",
      fetchFn,
    });
    const query: Record<string, number> = { constructor: 1, toString: 2 };
    const command = new GetMetricLabelsRequestCommand({
      header: undefined,
      param: { metricId: 42 },
      query,
    });

    await client.send(command);

    const call = fetchFn.mock.calls[0];
    assert(call);
    expect(call[0]).toContain("constructor=1");
    expect(call[0]).toContain("toString=2");
  });
});

describe("Generated Client reserved path parameters", () => {
  test("rejects an own __proto__ path parameter before fetch", async () => {
    const fetchFn = vi.fn<typeof globalThis.fetch>();
    const client = new MetricClient({
      baseUrl: "https://api.example.test",
      fetchFn,
    });
    const param: { metricId: number; [key: string]: number } = {
      metricId: 42,
    };
    Object.defineProperty(param, "__proto__", {
      value: 7,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    const command = new GetMetricRequestCommand({
      param,
      query: {},
      header: { "X-Attempt": 3 },
    });

    await expect(client.send(command)).rejects.toMatchObject({
      code: "REQUEST_SERIALIZATION_ERROR",
      location: "path",
      key: "__proto__",
      reason: "reserved-key",
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
