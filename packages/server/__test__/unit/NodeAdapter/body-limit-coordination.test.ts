import {
  notFoundDefaultError,
  payloadTooLargeDefaultError,
} from "@rexeus/typeweaver-core";
import { afterEach, describe, expect, test, vi } from "vitest";
import { PayloadTooLargeError } from "../../../src/lib/errors/index.js";
import { nodeAdapter } from "../../../src/lib/NodeAdapter.js";
import { TypeweaverApp } from "../../../src/lib/TypeweaverApp.js";
import {
  awaitResponse,
  createMockIncomingMessage,
  createMockServerResponse,
} from "../../node-helpers.js";
import {
  fakeAppReturning,
  fakeAppWithErrorReporter,
  invokeNodeAdapter,
} from "./fixtures.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Node default body limits", () => {
  test("accepts a body exactly at the default 1 MB limit when no maxBodySize option is provided", async () => {
    const app = fakeAppReturning(new Response("ok"));

    const body = "x".repeat(1_048_576);
    const handler = nodeAdapter(app);
    const req = createMockIncomingMessage(
      "POST",
      "/upload",
      { "content-type": "text/plain" },
      body
    );
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenStatus).toBe(200);
    const request = app.receivedRequests[0] as Request;
    expect(await request.text()).toBe(body);
  });

  test("rejects a body one byte over the default 1 MB limit when no maxBodySize option is provided", async () => {
    const onError = vi.fn();
    const app = fakeAppWithErrorReporter(
      fakeAppReturning(new Response("ok")),
      onError
    );

    const handler = nodeAdapter(app);
    const req = createMockIncomingMessage("POST", "/upload", {
      "content-length": "1048577",
      "content-type": "text/plain",
    });
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenStatus).toBe(413);
    expect(app.receivedRequests).toHaveLength(0);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      contentLength: 1_048_577,
      maxBodySize: 1_048_576,
    });
  });

  test("uses app maxBodySize when adapter option is omitted", async () => {
    const app = new TypeweaverApp({ maxBodySize: 8, onError: vi.fn() });

    const handler = nodeAdapter(app);
    const req = createMockIncomingMessage(
      "POST",
      "/upload",
      { "content-type": "text/plain" },
      "x".repeat(16)
    );
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenStatus).toBe(413);
    const parsed = JSON.parse(res.writtenBody) as Record<string, unknown>;
    expect(parsed).toEqual({
      code: payloadTooLargeDefaultError.code,
      message: payloadTooLargeDefaultError.message,
    });
  });
});

describe("Node app body limit coordination", () => {
  test("returns the app response after Node prevalidation consumes the body", async () => {
    const app = new TypeweaverApp({ maxBodySize: 64 });

    const handler = nodeAdapter(app, { maxBodySize: 16 });
    const req = createMockIncomingMessage(
      "POST",
      "/missing",
      { "content-type": "text/plain" },
      "hello"
    );
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenStatus).toBe(404);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: notFoundDefaultError.code,
      message: notFoundDefaultError.message,
    });
  });

  test("returns the app 413 when the adapter body limit is looser than the app body limit", async () => {
    const onError = vi.fn();
    const app = new TypeweaverApp({ maxBodySize: 8, onError });

    const handler = nodeAdapter(app, { maxBodySize: 16 });
    const req = createMockIncomingMessage(
      "POST",
      "/upload",
      { "content-type": "text/plain" },
      "x".repeat(12)
    );
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenStatus).toBe(413);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: payloadTooLargeDefaultError.code,
      message: payloadTooLargeDefaultError.message,
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(PayloadTooLargeError);
  });

  test("returns 413 for oversized GET content-length without dispatching to the app", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "GET",
      url: "/items",
      headers: { "content-length": "999" },
      response: new Response("ok"),
      adapterOptions: { maxBodySize: 1 },
    });

    expect(res.writtenStatus).toBe(413);
    expect(receivedRequests).toHaveLength(0);
  });
});

describe("Node body limits for bodyless methods", () => {
  test("returns 413 for oversized GET bodies identified only by transfer-encoding", async () => {
    const onError = vi.fn();
    const app = fakeAppWithErrorReporter(
      fakeAppReturning(new Response("ok")),
      onError
    );

    const handler = nodeAdapter(app, { maxBodySize: 4 });
    const req = createMockIncomingMessage(
      "GET",
      "/items",
      { "transfer-encoding": "chunked" },
      "hello"
    );
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenStatus).toBe(413);
    expect(app.receivedRequests).toHaveLength(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(PayloadTooLargeError);
  });

  test("returns 413 for oversized HEAD content-length without dispatching to the app", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "HEAD",
      url: "/items",
      headers: { "content-length": "999" },
      response: new Response("ok"),
      adapterOptions: { maxBodySize: 1 },
    });

    expect(res.writtenStatus).toBe(413);
    expect(res.writtenBodyBuffer).toEqual(Buffer.alloc(0));
    expect(receivedRequests).toHaveLength(0);
  });

  test("reports oversized body errors through app onError", async () => {
    const onError = vi.fn();
    const app = new TypeweaverApp({ maxBodySize: 64, onError });

    const handler = nodeAdapter(app, { maxBodySize: 8 });
    const req = createMockIncomingMessage(
      "POST",
      "/upload",
      { "content-type": "text/plain" },
      "x".repeat(16)
    );
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenStatus).toBe(413);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(PayloadTooLargeError);
  });
});
