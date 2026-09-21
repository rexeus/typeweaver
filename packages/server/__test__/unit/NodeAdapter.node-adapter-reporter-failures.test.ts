import {
  internalServerErrorDefaultError,
  payloadTooLargeDefaultError,
} from "@rexeus/typeweaver-core";
import { TestApplicationError, TestIoError } from "test-utils";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createNodeBodyLimitPolicy } from "../../src/lib/BodyLimitPolicy.js";
import {
  RequestBodyClosedBeforeEndError,
  RequestBodyReadAbortedError,
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

function fakeAppRejecting(error: unknown): FakeApp {
  const receivedRequests: Request[] = [];
  return {
    receivedRequests,
    fetch: async (request: Request) => {
      receivedRequests.push(request);
      throw error;
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Node adapter reporter failures", () => {
  test("reports non-error fetch rejections while returning default 500", async () => {
    const onError = vi.fn();
    const app = fakeAppWithErrorReporter(fakeAppRejecting("boom"), onError);

    const handler = nodeAdapter(app);
    const req = createMockIncomingMessage("GET", "/");
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenStatus).toBe(500);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: internalServerErrorDefaultError.code,
      message: internalServerErrorDefaultError.message,
    });
    expect(onError).toHaveBeenCalledWith("boom");
  });

  test("returns default 500 when the error reporter throws", async () => {
    const reporterError = new TestApplicationError("reporter failed");
    const app = new TypeweaverApp({
      onError: () => {
        throw reporterError;
      },
    });
    vi.spyOn(console, "error").mockImplementation(vi.fn());

    const handler = nodeAdapter(app);
    const req = createMockIncomingMessage("GET", "http://bad host", {
      host: undefined,
    });
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenStatus).toBe(500);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: internalServerErrorDefaultError.code,
      message: internalServerErrorDefaultError.message,
    });
  });

  test("logs the reporter failure with the original error when the error reporter throws", async () => {
    const reporterError = new TestApplicationError("reporter failed");
    let originalError: unknown;
    const app = new TypeweaverApp({
      onError: error => {
        originalError = error;
        throw reporterError;
      },
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    try {
      const handler = nodeAdapter(app);
      const req = createMockIncomingMessage("GET", "http://bad host", {
        host: undefined,
      });
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      expect(originalError).toBeInstanceOf(TypeError);
      expect(consoleSpy).toHaveBeenCalledWith(
        "TypeweaverApp: onError callback threw while handling error",
        { onErrorFailure: reporterError, originalError }
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });
});

describe("Node adapter response read failures", () => {
  test("returns default 500 when the response body cannot be read", async () => {
    const error = new TestIoError("response stream failed");
    const stream = new ReadableStream({
      start(controller) {
        controller.error(error);
      },
    });
    const onError = vi.fn();
    const app = fakeAppWithErrorReporter(
      fakeAppReturning(new Response(stream)),
      onError
    );

    const handler = nodeAdapter(app);
    const req = createMockIncomingMessage("GET", "/download");
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenStatus).toBe(500);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: internalServerErrorDefaultError.code,
      message: internalServerErrorDefaultError.message,
    });
    expect(onError).toHaveBeenCalledWith(error);
  });

  test("returns default 500 when POST body reading fails before app dispatch", async () => {
    const error = new TestIoError("request stream failed");
    const onError = vi.fn();
    const app = fakeAppWithErrorReporter(
      fakeAppReturning(new Response("ok")),
      onError
    );

    const handler = nodeAdapter(app);
    const req = createControlledIncomingMessage("POST", "/upload", {
      "content-type": "text/plain",
    });
    const res = createMockServerResponse(req);
    const responseFinished = awaitResponse(res);

    handler(req, res);
    req.emit("error", error);
    await responseFinished;

    expect(res.writtenStatus).toBe(500);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: internalServerErrorDefaultError.code,
      message: internalServerErrorDefaultError.message,
    });
    expect(app.receivedRequests).toHaveLength(0);
    expect(onError).toHaveBeenCalledWith(error);
  });
});

describe("Node adapter request read failures", () => {
  test("returns default 500 when POST closes before the body is fully read", async () => {
    const onError = vi.fn();
    const app = fakeAppWithErrorReporter(
      fakeAppReturning(new Response("ok")),
      onError
    );

    const handler = nodeAdapter(app);
    const req = createControlledIncomingMessage("POST", "/upload", {
      "content-type": "text/plain",
    });
    const res = createMockServerResponse(req);
    const responseFinished = awaitResponse(res);

    handler(req, res);
    req.push(Buffer.from("part"));
    req.emit("close");
    await responseFinished;

    expect(res.writtenStatus).toBe(500);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: internalServerErrorDefaultError.code,
      message: internalServerErrorDefaultError.message,
    });
    expect(app.receivedRequests).toHaveLength(0);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(
      RequestBodyClosedBeforeEndError
    );
    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      bytesRead: 0,
    });
  });

  test("returns default 500 when POST is aborted while reading the body", async () => {
    const onError = vi.fn();
    const app = fakeAppWithErrorReporter(
      fakeAppReturning(new Response("ok")),
      onError
    );

    const handler = nodeAdapter(app);
    const req = createControlledIncomingMessage("POST", "/upload", {
      "content-type": "text/plain",
    });
    const res = createMockServerResponse(req);
    const responseFinished = awaitResponse(res);

    handler(req, res);
    req.emit("aborted");
    await responseFinished;

    expect(res.writtenStatus).toBe(500);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: internalServerErrorDefaultError.code,
      message: internalServerErrorDefaultError.message,
    });
    expect(app.receivedRequests).toHaveLength(0);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(
      RequestBodyReadAbortedError
    );
    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      bytesRead: 0,
    });
  });

  test("logs error to console.error", async () => {
    const error = new TestApplicationError("something broke");
    const app = fakeAppRejecting(error);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    const handler = nodeAdapter(app);
    const req = createMockIncomingMessage("GET", "/");
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(consoleSpy).toHaveBeenCalledWith(error);
  });
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
