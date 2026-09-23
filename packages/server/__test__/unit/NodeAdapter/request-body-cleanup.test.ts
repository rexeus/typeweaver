import {
  badRequestDefaultError,
  notFoundDefaultError,
  payloadTooLargeDefaultError,
} from "@rexeus/typeweaver-core";
import { TestIoError } from "test-utils";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  PayloadTooLargeError,
  RequestBodyDrainTimeoutError,
} from "../../../src/lib/errors/index.js";
import { nodeAdapter } from "../../../src/lib/NodeAdapter.js";
import { TypeweaverApp } from "../../../src/lib/TypeweaverApp.js";
import {
  awaitResponse,
  createControlledIncomingMessage,
  createMockIncomingMessage,
  createMockServerResponse,
} from "../../node-helpers.js";
import {
  captureDrainedRequestBody,
  expectRequest,
  fakeAppReturning,
  fakeAppWithErrorReporter,
  waitForRequestStreamToResume,
} from "./fixtures.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Node skipped request body cleanup", () => {
  test("drains skipped GET request bodies identified only by transfer-encoding", async () => {
    const app = fakeAppReturning(new Response("ok"));

    const handler = nodeAdapter(app, { maxBodySize: 5 });
    const req = createMockIncomingMessage(
      "GET",
      "/items",
      { "transfer-encoding": "chunked" },
      "hello"
    );
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    const request = app.receivedRequests[0] as Request;
    expect(res.writtenStatus).toBe(200);
    expect(request.body).toBeNull();
  });

  test.each([{ method: "GET" }, { method: "HEAD" }])(
    "accepts skipped $method request bodies exactly at maxBodySize",
    async ({ method }) => {
      const app = fakeAppReturning(new Response("ok"));

      const handler = nodeAdapter(app, { maxBodySize: 5 });
      const req = createMockIncomingMessage(
        method,
        "/items",
        { "content-length": "5" },
        "hello"
      );
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      const request = app.receivedRequests[0] as Request;
      expect(res.writtenStatus).toBe(200);
      expect(request.body).toBeNull();
    }
  );

  test("continues skipped GET requests when the body stream closes early", async () => {
    const app = fakeAppReturning(new Response("ok"));

    const handler = nodeAdapter(app, { maxBodySize: 5 });
    const req = createControlledIncomingMessage("GET", "/items", {
      "content-length": "5",
    });
    const drainStarted = waitForRequestStreamToResume(req);
    const res = createMockServerResponse(req);
    const responseFinished = awaitResponse(res);

    handler(req, res);
    await drainStarted;
    req.emit("close");
    await responseFinished;

    expect(res.writtenStatus).toBe(200);
    expect(app.receivedRequests).toHaveLength(1);
  });

  test("continues skipped GET requests when the body stream is aborted", async () => {
    const onError = vi.fn();
    const app = fakeAppWithErrorReporter(
      fakeAppReturning(new Response("ok")),
      onError
    );

    const handler = nodeAdapter(app, { maxBodySize: 5 });
    const req = createControlledIncomingMessage("GET", "/items", {
      "content-length": "5",
    });
    const drainStarted = waitForRequestStreamToResume(req);
    const res = createMockServerResponse(req);
    const responseFinished = awaitResponse(res);

    handler(req, res);
    await drainStarted;
    req.emit("aborted");
    await responseFinished;

    expect(res.writtenStatus).toBe(200);
    expect(app.receivedRequests).toHaveLength(1);
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("Node skipped body cleanup failures", () => {
  test("writes the app response when skipped GET body drain emits an error", async () => {
    const onError = vi.fn();
    const app = new TypeweaverApp({ onError });

    const handler = nodeAdapter(app);
    const req = createControlledIncomingMessage("GET", "/items", {
      "content-length": "5",
    });
    const drainStarted = waitForRequestStreamToResume(req);
    const res = createMockServerResponse(req);
    const responseFinished = awaitResponse(res);

    handler(req, res);
    await drainStarted;
    req.push(Buffer.from("hello"));
    req.emit("error", new TestIoError("drain failed"));
    req.push(null);
    await responseFinished;

    expect(res.writtenStatus).toBe(404);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: notFoundDefaultError.code,
      message: notFoundDefaultError.message,
    });
    expect(onError).not.toHaveBeenCalled();
  });

  test("returns 413 before destroying oversized skipped GET bodies during cleanup", async () => {
    const onError = vi.fn();
    const app = new TypeweaverApp({ onError });

    const handler = nodeAdapter(app, { maxBodySize: 4 });
    const req = createControlledIncomingMessage("GET", "/items", {
      "content-length": "4",
    });
    const drainStarted = waitForRequestStreamToResume(req);
    const res = createMockServerResponse(req);
    const responseFinished = awaitResponse(res);

    handler(req, res);
    await drainStarted;
    req.push(Buffer.from("12345"));
    await responseFinished;

    expect(res.writtenStatus).toBe(413);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: payloadTooLargeDefaultError.code,
      message: payloadTooLargeDefaultError.message,
    });
    expect(req.destroyed).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(PayloadTooLargeError);

    req.push(Buffer.from("again"));

    expect(req.destroyed).toBe(true);
  });
});

describe("Node skipped body destructive cleanup", () => {
  test("returns 413 before destroying timed-out skipped GET bodies during cleanup", async () => {
    vi.useFakeTimers();
    try {
      const onError = vi.fn();
      const app = new TypeweaverApp({ onError });

      const handler = nodeAdapter(app, { maxBodySize: 4 });
      const req = createControlledIncomingMessage("GET", "/items", {
        "content-length": "4",
      });
      const drainStarted = waitForRequestStreamToResume(req);
      const res = createMockServerResponse(req);
      const responseFinished = awaitResponse(res);

      handler(req, res);
      await drainStarted;
      await vi.advanceTimersByTimeAsync(5_000);
      await responseFinished;

      expect(res.writtenStatus).toBe(413);
      expect(JSON.parse(res.writtenBody)).toEqual({
        code: payloadTooLargeDefaultError.code,
        message: payloadTooLargeDefaultError.message,
      });
      expect(req.destroyed).toBe(false);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(
        RequestBodyDrainTimeoutError
      );
      expect(onError.mock.calls[0]?.[0]).toMatchObject({
        maxBodySize: 4,
        timeoutMs: 5_000,
      });
      expect(onError.mock.calls[0]?.[0]).not.toHaveProperty("contentLength");

      await vi.advanceTimersByTimeAsync(5_000);

      expect(req.destroyed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  test("omits body for HEAD", async () => {
    const app = fakeAppReturning(new Response(""));

    const handler = nodeAdapter(app);
    const req = createMockIncomingMessage("HEAD", "/items");
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    const request = app.receivedRequests[0] as Request;
    expect(expectRequest(request).body).toBeNull();
  });
});

describe("Node invalid-target request cleanup", () => {
  test("drains authority-like request bodies after returning bad request", async () => {
    const app = fakeAppReturning(new Response("ok"));

    const handler = nodeAdapter(app, { maxBodySize: 5 });
    const req = createControlledIncomingMessage(
      "POST",
      "/\\attacker.example/path",
      {
        "content-length": "5",
        host: "victim.example",
      }
    );
    const drainedBody = captureDrainedRequestBody(req);
    const drainStarted = waitForRequestStreamToResume(req);
    const res = createMockServerResponse(req);
    const responseFinished = awaitResponse(res);

    handler(req, res);
    await responseFinished;
    await drainStarted;
    req.push(Buffer.from("hello"));
    req.push(null);

    expect(res.writtenStatus).toBe(400);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: badRequestDefaultError.code,
      message: badRequestDefaultError.message,
    });
    expect(await drainedBody).toBe("hello");
    expect(app.receivedRequests).toHaveLength(0);
  });

  test("drains malformed host request bodies after returning bad request", async () => {
    const app = fakeAppReturning(new Response("ok"));

    const handler = nodeAdapter(app, { maxBodySize: 5 });
    const req = createControlledIncomingMessage("POST", "/items", {
      "content-length": "5",
      host: "bad host",
    });
    const drainedBody = captureDrainedRequestBody(req);
    const drainStarted = waitForRequestStreamToResume(req);
    const res = createMockServerResponse(req);
    const responseFinished = awaitResponse(res);

    handler(req, res);
    await responseFinished;
    await drainStarted;
    req.push(Buffer.from("hello"));
    req.push(null);

    expect(res.writtenStatus).toBe(400);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: badRequestDefaultError.code,
      message: badRequestDefaultError.message,
    });
    expect(await drainedBody).toBe("hello");
    expect(app.receivedRequests).toHaveLength(0);
  });
});

describe("Node invalid-host body limit cleanup", () => {
  test("destroys malformed host chunked bodies that exceed the cleanup limit", async () => {
    const app = fakeAppReturning(new Response("ok"));

    const handler = nodeAdapter(app, { maxBodySize: 4 });
    const req = createControlledIncomingMessage("POST", "/items", {
      host: "bad host",
      "transfer-encoding": "chunked",
    });
    const drainStarted = waitForRequestStreamToResume(req);
    const res = createMockServerResponse(req);
    const responseFinished = awaitResponse(res);

    handler(req, res);
    await responseFinished;
    await drainStarted;
    req.push(Buffer.from("hello"));

    expect(res.writtenStatus).toBe(400);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: badRequestDefaultError.code,
      message: badRequestDefaultError.message,
    });
    expect(req.destroyed).toBe(true);
    expect(app.receivedRequests).toHaveLength(0);
  });

  test("destroys malformed host request bodies immediately when content-length exceeds the cleanup limit", async () => {
    const app = fakeAppReturning(new Response("ok"));

    const handler = nodeAdapter(app, { maxBodySize: 4 });
    const req = createControlledIncomingMessage("POST", "/items", {
      "content-length": "999",
      host: "bad host",
    });
    const res = createMockServerResponse(req);
    const responseFinished = awaitResponse(res);

    handler(req, res);
    await responseFinished;

    expect(res.writtenStatus).toBe(400);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: badRequestDefaultError.code,
      message: badRequestDefaultError.message,
    });
    expect(req.destroyed).toBe(true);
    expect(app.receivedRequests).toHaveLength(0);
  });
});
