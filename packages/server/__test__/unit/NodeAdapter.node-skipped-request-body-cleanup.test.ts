import { IncomingMessage } from "node:http";
import {
  notFoundDefaultError,
  payloadTooLargeDefaultError,
} from "@rexeus/typeweaver-core";
import { TestAssertionError, TestIoError } from "test-utils";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createNodeBodyLimitPolicy } from "../../src/lib/BodyLimitPolicy.js";
import {
  PayloadTooLargeError,
  RequestBodyDrainTimeoutError,
} from "../../src/lib/errors/index.js";
import { nodeAdapter } from "../../src/lib/NodeAdapter.js";
import { TypeweaverApp } from "../../src/lib/TypeweaverApp.js";
import { setTypeweaverAppRuntimeContext } from "../../src/lib/TypeweaverInternals.js";
import {
  awaitResponse,
  createControlledIncomingMessage,
  createMockIncomingMessage,
  createMockServerResponse,
} from "../node-helpers.js";

type FakeApp = TypeweaverApp<Record<string, unknown>> & {
  readonly receivedRequests: readonly Request[];
};

function fakeAppReturning(response: Response): FakeApp {
  const receivedRequests: Request[] = [];
  return {
    receivedRequests,
    fetch: async (request: Request) => {
      receivedRequests.push(request);
      return response;
    },
  } as unknown as FakeApp;
}

function fakeAppWithErrorReporter(
  app: FakeApp,
  reportError: (error: unknown) => void,
  maxBodySize?: number
): FakeApp {
  setTypeweaverAppRuntimeContext(app, {
    bodyLimitPolicy: createNodeBodyLimitPolicy(maxBodySize),
    reportError,
  });

  return app;
}

function waitForRequestStreamToResume(req: IncomingMessage): Promise<void> {
  return new Promise<void>(resolve => {
    const originalResume = req.resume.bind(req);
    vi.spyOn(req, "resume").mockImplementation(() => {
      resolve();
      return originalResume();
    });
  });
}

function expectRequest(request: Request | undefined): Request {
  if (request === undefined) {
    throw new TestAssertionError("Expected app.fetch to receive a Request");
  }

  return request;
}

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

describe("response translation", () => {
  test("writes status code", async () => {
    const app = fakeAppReturning(new Response("", { status: 201 }));

    const handler = nodeAdapter(app);
    const req = createMockIncomingMessage("GET", "/");
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenStatus).toBe(201);
  });

  test("writes response headers", async () => {
    const app = fakeAppReturning(
      new Response("{}", {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-custom": "value",
        },
      })
    );

    const handler = nodeAdapter(app);
    const req = createMockIncomingMessage("GET", "/");
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenHeaders["content-type"]).toBe("application/json");
    expect(res.writtenHeaders["x-custom"]).toBe("value");
  });

  test("writes response body", async () => {
    const app = fakeAppReturning(new Response('{"ok":true}', { status: 200 }));

    const handler = nodeAdapter(app);
    const req = createMockIncomingMessage("GET", "/");
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenBody).toBe('{"ok":true}');
  });

  test("preserves binary response body without corruption", async () => {
    const binaryData = new Uint8Array([
      0x00, 0x01, 0x80, 0xff, 0xfe, 0x89, 0x50, 0x4e, 0x47,
    ]);
    const app = fakeAppReturning(
      new Response(binaryData, {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      })
    );

    const handler = nodeAdapter(app);
    const req = createMockIncomingMessage("GET", "/download");
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenBodyBuffer).toEqual(Buffer.from(binaryData));
  });
});

describe("Node response header multiplicity", () => {
  test("preserves multiple Set-Cookie headers individually", async () => {
    const headers = new Headers();
    headers.append("set-cookie", "session=abc; Path=/; HttpOnly");
    headers.append("set-cookie", "theme=dark; Path=/");
    headers.append("content-type", "text/html");

    const app = fakeAppReturning(new Response("ok", { status: 200, headers }));

    const handler = nodeAdapter(app);
    const req = createMockIncomingMessage("GET", "/");
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenRawHeaders["set-cookie"]).toEqual([
      "session=abc; Path=/; HttpOnly",
      "theme=dark; Path=/",
    ]);
    expect(res.writtenHeaders["content-type"]).toBe("text/html");
  });

  test("omits response body for HEAD requests at the Node boundary", async () => {
    const app = fakeAppReturning(new Response("body that must not be written"));

    const handler = nodeAdapter(app);
    const req = createMockIncomingMessage("HEAD", "/download");
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenStatus).toBe(200);
    expect(res.writtenBody).toBe("");
    expect(res.writtenBodyBuffer).toEqual(Buffer.alloc(0));
  });
});
