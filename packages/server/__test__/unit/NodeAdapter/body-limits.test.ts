import { payloadTooLargeDefaultError } from "@rexeus/typeweaver-core";
import { TestIoError } from "test-utils";
import { afterEach, describe, expect, test, vi } from "vitest";
import { PayloadTooLargeError } from "../../../src/lib/errors/index.js";
import { nodeAdapter } from "../../../src/lib/NodeAdapter.js";
import { TypeweaverApp } from "../../../src/lib/TypeweaverApp.js";
import {
  awaitResponse,
  createControlledIncomingMessage,
  createMockIncomingMessage,
  createMockServerResponse,
} from "../../node-helpers.js";
import { fakeAppReturning, fakeAppWithErrorReporter } from "./fixtures.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("body size enforcement", () => {
  test("returns 413 when body exceeds maxBodySize", async () => {
    const app = fakeAppWithErrorReporter(
      fakeAppReturning(new Response("")),
      vi.fn()
    );

    const handler = nodeAdapter(app, { maxBodySize: 16 });
    const body = "x".repeat(32);
    const req = createMockIncomingMessage(
      "POST",
      "/upload",
      { "content-type": "text/plain" },
      body
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

  test("returns 413 before app dispatch when POST content-length exceeds maxBodySize", async () => {
    const onError = vi.fn();
    const app = fakeAppWithErrorReporter(
      fakeAppReturning(new Response("ok")),
      onError
    );

    const handler = nodeAdapter(app, { maxBodySize: 4 });
    const req = createMockIncomingMessage("POST", "/upload", {
      "content-length": "5",
      "content-type": "text/plain",
    });
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenStatus).toBe(413);
    expect(app.receivedRequests).toHaveLength(0);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      contentLength: 5,
      maxBodySize: 4,
    });
  });

  test("returns 413 for invalid content-length when streamed body exceeds maxBodySize", async () => {
    const onError = vi.fn();
    const app = fakeAppWithErrorReporter(
      fakeAppReturning(new Response("ok")),
      onError
    );

    const handler = nodeAdapter(app, { maxBodySize: 4 });
    const req = createMockIncomingMessage(
      "POST",
      "/upload",
      {
        "content-length": "not-a-number",
        "content-type": "text/plain",
      },
      "hello"
    );
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenStatus).toBe(413);
    expect(app.receivedRequests).toHaveLength(0);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      contentLength: 5,
      maxBodySize: 4,
    });
  });
});

describe("Node streamed body limits", () => {
  test("returns 413 when the actual POST body exceeds an under-declared content-length", async () => {
    const onError = vi.fn();
    const app = fakeAppWithErrorReporter(
      fakeAppReturning(new Response("ok")),
      onError
    );

    const handler = nodeAdapter(app, { maxBodySize: 4 });
    const req = createMockIncomingMessage(
      "POST",
      "/upload",
      {
        "content-length": "1",
        "content-type": "text/plain",
      },
      "hello"
    );
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenStatus).toBe(413);
    expect(app.receivedRequests).toHaveLength(0);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      contentLength: 5,
      maxBodySize: 4,
    });
  });

  test("accepts empty POST bodies when maxBodySize is zero", async () => {
    const app = fakeAppReturning(new Response("ok"));

    const handler = nodeAdapter(app, { maxBodySize: 0 });
    const req = createMockIncomingMessage(
      "POST",
      "/upload",
      { "content-type": "text/plain" },
      ""
    );
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    const request = app.receivedRequests[0] as Request;
    expect(res.writtenStatus).toBe(200);
    expect(await request.text()).toBe("");
  });

  test("rejects non-empty POST bodies when maxBodySize is zero", async () => {
    const onError = vi.fn();
    const app = fakeAppWithErrorReporter(
      fakeAppReturning(new Response("ok")),
      onError
    );

    const handler = nodeAdapter(app, { maxBodySize: 0 });
    const req = createMockIncomingMessage(
      "POST",
      "/upload",
      { "content-type": "text/plain" },
      "x"
    );
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenStatus).toBe(413);
    expect(app.receivedRequests).toHaveLength(0);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      contentLength: 1,
      maxBodySize: 0,
    });
  });
});

describe("Node body limit header edge cases", () => {
  test("accepts a request when the first duplicate content-length value is within the limit", async () => {
    const app = fakeAppReturning(new Response("ok"));

    const handler = nodeAdapter(app, { maxBodySize: 4 });
    const req = createMockIncomingMessage(
      "POST",
      "/upload",
      {
        "content-length": ["4", "999"],
        "content-type": "text/plain",
      },
      "data"
    );
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    const request = app.receivedRequests[0] as Request;
    expect(res.writtenStatus).toBe(200);
    expect(await request.text()).toBe("data");
  });

  test("preserves unrelated request end and close listeners after rejecting an oversized body", async () => {
    const app = new TypeweaverApp({ onError: vi.fn() });

    const handler = nodeAdapter(app, { maxBodySize: 4 });
    const req = createMockIncomingMessage(
      "POST",
      "/upload",
      { "content-type": "text/plain" },
      "hello"
    );
    const endListener = vi.fn();
    req.on("end", endListener);
    const closeListener = vi.fn();
    req.on("close", closeListener);
    const closePromise = new Promise<void>(resolve => {
      req.on("close", () => resolve());
    });
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);
    await closePromise;

    expect(res.writtenStatus).toBe(413);
    expect(endListener).toHaveBeenCalledTimes(1);
    expect(closeListener).toHaveBeenCalled();
  });

  test("preserves the 413 response when post-limit body drain emits an error", async () => {
    const onError = vi.fn();
    const app = new TypeweaverApp({ onError });

    const handler = nodeAdapter(app, { maxBodySize: 4 });
    const req = createControlledIncomingMessage("POST", "/upload", {
      "content-type": "text/plain",
    });
    const res = createMockServerResponse(req);
    const responseFinished = awaitResponse(res);

    handler(req, res);
    req.push(Buffer.from("hello"));
    await responseFinished;
    req.emit("error", new TestIoError("drain failed"));
    req.push(null);

    expect(res.writtenStatus).toBe(413);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: payloadTooLargeDefaultError.code,
      message: payloadTooLargeDefaultError.message,
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(PayloadTooLargeError);
  });
});

describe("Node post-limit cleanup", () => {
  test("stops post-limit body draining without replacing the original 413 error", async () => {
    const onError = vi.fn();
    const app = new TypeweaverApp({ onError });

    const handler = nodeAdapter(app, { maxBodySize: 4 });
    const req = createControlledIncomingMessage("POST", "/upload", {
      "content-type": "text/plain",
    });
    const res = createMockServerResponse(req);
    const responseFinished = awaitResponse(res);

    handler(req, res);
    req.push(Buffer.from("hello"));
    await responseFinished;
    req.push(Buffer.from("again"));

    expect(res.writtenStatus).toBe(413);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: payloadTooLargeDefaultError.code,
      message: payloadTooLargeDefaultError.message,
    });
    expect(req.destroyed).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      contentLength: 5,
      maxBodySize: 4,
    });
  });

  test("starts destructive post-limit cleanup after the 413 response finishes", async () => {
    const onError = vi.fn();
    const app = new TypeweaverApp({ onError });

    const handler = nodeAdapter(app, { maxBodySize: 4 });
    const req = createControlledIncomingMessage("POST", "/upload", {
      "content-type": "text/plain",
    });
    const events: string[] = [];
    const originalDestroy = req.destroy.bind(req);
    vi.spyOn(req, "destroy").mockImplementation((error?: Error) => {
      events.push("destroy");
      return originalDestroy(error);
    });
    const res = createMockServerResponse(req);
    const responseFinished = awaitResponse(res);
    res.once("finish", () => {
      events.push("finish");
    });

    handler(req, res);
    req.push(Buffer.from("hello"));
    await responseFinished;

    expect(events).toEqual(["finish"]);

    req.push(Buffer.from("again"));

    expect(res.writtenStatus).toBe(413);
    expect(events).toEqual(["finish", "destroy"]);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(PayloadTooLargeError);
  });

  test("passes body through when exactly at maxBodySize", async () => {
    const app = fakeAppReturning(new Response("ok"));

    const body = "x".repeat(64);
    const handler = nodeAdapter(app, { maxBodySize: 64 });
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
});
