import assert from "node:assert";
import { UnknownResponseError } from "@rexeus/typeweaver-core";
import type { IHttpResponse } from "@rexeus/typeweaver-core";
import {
  createGetTodoRequest,
  GetMetricRequestCommand,
  GetTodoRequestCommand,
  MetricClient,
  TestAssertionError,
} from "test-utils";
import { afterEach, describe, expect, test, vi } from "vitest";
import { runClientCleanup, setupClientTest } from "./clientSetup.js";

async function captureUnknownResponseError(
  act: () => Promise<unknown>
): Promise<UnknownResponseError> {
  try {
    await act();
  } catch (error) {
    expect(error).toBeInstanceOf(UnknownResponseError);
    assert(error instanceof UnknownResponseError);
    return error;
  }

  throw new TestAssertionError("Expected UnknownResponseError to be thrown");
}

afterEach(async () => {
  await runClientCleanup();
});

describe("Unknown Response Handling", () => {
  test("preserves known status response details when validation rejects the body", async () => {
    const unknownBody = { unexpectedField: "unexpected value" };
    const { client } = await setupClientTest({
      customResponses: {
        statusCode: 200,
        header: {
          "Content-Type": "application/json",
          "X-Single-Value": "invalid-success",
        },
        body: unknownBody,
      } satisfies IHttpResponse,
    });
    const requestData = createGetTodoRequest();
    const command = new GetTodoRequestCommand(requestData);

    const error = await captureUnknownResponseError(() => client.send(command));

    expect(error.statusCode).toBe(200);
    expect(error.header).toMatchObject({
      "content-type": "application/json",
      "x-single-value": "invalid-success",
    });
    expect(error.body).toEqual(unknownBody);
  });

  test("preserves unknown status response details when no generated variant matches", async () => {
    const unknownBody = { error: "Bad request with unknown structure" };
    const { client } = await setupClientTest({
      customResponses: {
        statusCode: 418,
        header: {
          "Content-Type": "application/json",
          "X-Single-Value": "unknown-status",
        },
        body: unknownBody,
      } satisfies IHttpResponse,
    });
    const requestData = createGetTodoRequest();
    const command = new GetTodoRequestCommand(requestData);

    const error = await captureUnknownResponseError(() => client.send(command));

    expect(error.statusCode).toBe(418);
    expect(error.header).toMatchObject({
      "content-type": "application/json",
      "x-single-value": "unknown-status",
    });
    expect(error.body).toEqual(unknownBody);
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
