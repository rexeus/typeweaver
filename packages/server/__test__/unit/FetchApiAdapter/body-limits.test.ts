import { describe, expect, test, vi } from "vitest";
import { createNodeBodyLimitPolicy } from "../../../src/lib/BodyLimitPolicy.js";
import { PayloadTooLargeError } from "../../../src/lib/Errors.js";
import { FetchApiAdapter } from "../../../src/lib/FetchApiAdapter.js";
import { BASE_URL } from "../../helpers.js";
import {
  createAdapterRequest,
  createAdapterRequestWithStream,
  createBodyStream,
  createSixByteStream,
  expectPayloadTooLargeError,
} from "./fixtures.js";

describe("Fetch Content-Length body limits", () => {
  test("rejects requests when Content-Length exceeds the limit", async () => {
    const adapter = new FetchApiAdapter({ maxBodySize: 100 });
    const body = "x".repeat(200);
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "Content-Length": String(body.length),
      },
      body,
    });

    await expectPayloadTooLargeError(adapter.toRequest(request), 200, 100);
  });

  test("accepts requests when Content-Length is within the limit", async () => {
    const adapter = new FetchApiAdapter({ maxBodySize: 1000 });
    const body = "hello";
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "Content-Length": String(body.length),
      },
      body,
    });

    const result = await adapter.toRequest(request);

    expect(result.body).toBe("hello");
  });

  test("accepts valid bodies when Content-Length is invalid", async () => {
    const adapter = new FetchApiAdapter({ maxBodySize: 100 });
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "Content-Length": "not-a-number",
      },
      body: "hello",
    });

    const result = await adapter.toRequest(request);

    expect(result.body).toBe("hello");
  });

  test("rejects oversized requests with invalid Content-Length by reading the body", async () => {
    const adapter = new FetchApiAdapter({ maxBodySize: 4 });
    const request = createAdapterRequest("/todos", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "Content-Length": "not-a-number",
      },
      body: "hello",
    });

    await expectPayloadTooLargeError(adapter.toRequest(request), 5, 4);
  });

  test("falls back to streaming validation for negative Content-Length", async () => {
    const adapter = new FetchApiAdapter({ maxBodySize: 100 });
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      body: JSON.stringify({ ok: true }),
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "-1",
      },
    });

    const result = await adapter.toRequest(request);

    expect(result.body).toEqual({ ok: true });
  });

  test("omits null bodies during streaming validation", async () => {
    const adapter = new FetchApiAdapter({ maxBodySize: 100 });
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const result = await adapter.toRequest(request);

    expect(result.body).toBeUndefined();
  });
});

describe("Fetch default and streaming body limits", () => {
  test("accepts bodies at the exact Content-Length limit", async () => {
    const adapter = new FetchApiAdapter({ maxBodySize: 100 });
    const body = "x".repeat(100);
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "Content-Length": String(body.length),
      },
      body,
    });

    const result = await adapter.toRequest(request);

    expect(result.body).toBe(body);
  });

  test("uses the default body size limit when maxBodySize is not configured", async () => {
    const adapter = new FetchApiAdapter();
    const body = "x".repeat(10000);
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "Content-Length": String(body.length),
      },
      body,
    });

    const result = await adapter.toRequest(request);

    expect(result.body).toBe(body);
  });

  test("rejects oversized bodies when Content-Length is missing", async () => {
    const adapter = new FetchApiAdapter({ maxBodySize: 50 });
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      body: "x".repeat(100),
    });
    request.headers.delete("content-length");

    await expect(adapter.toRequest(request)).rejects.toThrow(
      PayloadTooLargeError
    );
  });

  test("rejects under-declared Content-Length streams and cancels the stream", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const actualBodySize = 6;
    const maxBodySize = 4;
    const body = createSixByteStream(cancel);
    const request = createAdapterRequestWithStream(
      "/todos",
      {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(maxBodySize),
      },
      body
    );
    const adapter = new FetchApiAdapter({ maxBodySize });

    await expectPayloadTooLargeError(
      adapter.toRequest(request),
      actualBodySize,
      maxBodySize
    );

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  test("accepts stream chunks that exactly reach the body limit", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const body = createBodyStream(["he", "llo"], cancel);
    const request = createAdapterRequestWithStream(
      "/todos",
      { "Content-Type": "text/plain" },
      body
    );
    const adapter = new FetchApiAdapter({ maxBodySize: 5 });

    const result = await adapter.toRequest(request);

    expect(result.body).toBe("hello");
    expect(cancel).not.toHaveBeenCalled();
  });
});

describe("Fetch missing Content-Length and custom body policies", () => {
  test("accepts bodies within the limit when Content-Length is missing", async () => {
    const adapter = new FetchApiAdapter({ maxBodySize: 200 });
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hello" }),
    });
    request.headers.delete("content-length");

    const result = await adapter.toRequest(request);

    expect(result.body).toEqual({ title: "Hello" });
  });

  test("accepts bodies at the exact limit when Content-Length is missing", async () => {
    const body = "x".repeat(50);
    const adapter = new FetchApiAdapter({ maxBodySize: 50 });
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body,
    });
    request.headers.delete("content-length");

    const result = await adapter.toRequest(request);

    expect(result.body).toBe(body);
  });

  test("rejects oversized multipart bodies when Content-Length is missing", async () => {
    const actualBodySize = 6;
    const maxBodySize = 4;
    const adapter = new FetchApiAdapter({ maxBodySize });
    const request = createAdapterRequestWithStream(
      "/todos",
      { "Content-Type": "multipart/form-data; boundary=typeweaver-test" },
      createSixByteStream(vi.fn())
    );

    await expectPayloadTooLargeError(
      adapter.toRequest(request),
      actualBodySize,
      maxBodySize
    );
  });

  test("uses explicit bodyLimitPolicy instead of maxBodySize", async () => {
    const actualBodySize = 5;
    const maxBodySize = 4;
    const adapter = new FetchApiAdapter({
      maxBodySize: 10,
      bodyLimitPolicy: createNodeBodyLimitPolicy(maxBodySize),
    });
    const request = createAdapterRequest("/todos", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "x".repeat(actualBodySize),
    });

    await expectPayloadTooLargeError(
      adapter.toRequest(request),
      actualBodySize,
      maxBodySize
    );
  });
});
