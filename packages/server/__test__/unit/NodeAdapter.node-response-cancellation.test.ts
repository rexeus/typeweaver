import { internalServerErrorDefaultError } from "@rexeus/typeweaver-core";
import { TestApplicationError, TestIoError } from "test-utils";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createNodeBodyLimitPolicy } from "../../src/lib/BodyLimitPolicy.js";
import { nodeAdapter } from "../../src/lib/NodeAdapter.js";
import { TypeweaverApp } from "../../src/lib/TypeweaverApp.js";
import { setTypeweaverAppRuntimeContext } from "../../src/lib/TypeweaverInternals.js";
import {
  awaitResponse,
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

function typeweaverAppReturning(
  response: Response,
  options?: ConstructorParameters<typeof TypeweaverApp>[0]
): TypeweaverApp<Record<string, unknown>> {
  const app = new TypeweaverApp(options);
  app.fetch = async () => response;

  return app;
}

function responseWithCancelableBody(status: number) {
  const response = new Response(new ReadableStream());
  Object.defineProperty(response, "status", { value: status });
  const cancelSpy = vi
    .spyOn(response.body as ReadableStream, "cancel")
    .mockResolvedValue();

  return { cancelSpy, response };
}

function responseWithRejectingCancelableBody(
  status: number,
  cancelError: unknown
) {
  const response = new Response(new ReadableStream(), {
    headers: { "x-suppressed": "yes" },
  });
  Object.defineProperty(response, "status", { value: status });
  const cancelSpy = vi
    .spyOn(response.body as ReadableStream, "cancel")
    .mockRejectedValue(cancelError);

  return { cancelSpy, response };
}

function responseWithThrowingCancelableBody(
  status: number,
  cancelError: unknown
) {
  const response = new Response(new ReadableStream(), {
    headers: { "x-suppressed": "yes" },
  });
  Object.defineProperty(response, "status", { value: status });
  const cancelSpy = vi
    .spyOn(response.body as ReadableStream, "cancel")
    .mockImplementation(() => {
      throw cancelError;
    });

  return { cancelSpy, response };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Node response cancellation", () => {
  test.each([
    { status: 204, scenario: "no content" },
    { status: 304, scenario: "not modified" },
  ])("omits response body for $scenario responses", async ({ status }) => {
    const app = fakeAppReturning(new Response(null, { status }));

    const handler = nodeAdapter(app);
    const req = createMockIncomingMessage("GET", "/resource");
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenStatus).toBe(status);
    expect(res.writtenBody).toBe("");
    expect(res.writtenBodyBuffer).toEqual(Buffer.alloc(0));
  });
});

describe("Node response cancellation failures", () => {
  test.each([
    { method: "HEAD", status: 200, scenario: "a HEAD request" },
    { method: "GET", status: 204, scenario: "a 204 no-content response" },
    { method: "GET", status: 304, scenario: "a 304 not-modified response" },
  ])(
    "cancels the response body stream for $scenario when the body is suppressed",
    async ({ method, status }) => {
      const { cancelSpy, response } = responseWithCancelableBody(status);
      const app = fakeAppReturning(response);

      const handler = nodeAdapter(app);
      const req = createMockIncomingMessage(method, "/resource");
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      expect(res.writtenStatus).toBe(status);
      expect(res.writtenBodyBuffer).toEqual(Buffer.alloc(0));
      expect(cancelSpy).toHaveBeenCalledTimes(1);
    }
  );

  test.each([
    { method: "HEAD", status: 200, scenario: "a HEAD request" },
    { method: "GET", status: 204, scenario: "a 204 no-content response" },
    { method: "GET", status: 304, scenario: "a 304 not-modified response" },
  ])(
    "reports the suppressed body cancellation error without preventing the response for $scenario",
    async ({ method, status }) => {
      const cancelError = new TestIoError("cancel failed");
      const { cancelSpy, response } = responseWithRejectingCancelableBody(
        status,
        cancelError
      );
      const onError = vi.fn();
      const app = fakeAppWithErrorReporter(fakeAppReturning(response), onError);

      const handler = nodeAdapter(app);
      const req = createMockIncomingMessage(method, "/resource");
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);
      await Promise.resolve();

      expect(res.writtenStatus).toBe(status);
      expect(res.writtenHeaders["x-suppressed"]).toBe("yes");
      expect(res.writtenBodyBuffer).toEqual(Buffer.alloc(0));
      expect(cancelSpy).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(cancelError);
    }
  );

  test.each([
    { method: "HEAD", status: 200, scenario: "a HEAD request" },
    { method: "GET", status: 204, scenario: "a 204 no-content response" },
    { method: "GET", status: 304, scenario: "a 304 not-modified response" },
  ])(
    "reports a synchronous suppressed body cancellation error without preventing the response for $scenario",
    async ({ method, status }) => {
      const cancelError = new TestIoError("cancel failed synchronously");
      const { cancelSpy, response } = responseWithThrowingCancelableBody(
        status,
        cancelError
      );
      const onError = vi.fn();
      const app = fakeAppWithErrorReporter(fakeAppReturning(response), onError);

      const handler = nodeAdapter(app);
      const req = createMockIncomingMessage(method, "/resource");
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      expect(res.writtenStatus).toBe(status);
      expect(res.writtenHeaders["x-suppressed"]).toBe("yes");
      expect(res.writtenBodyBuffer).toEqual(Buffer.alloc(0));
      expect(cancelSpy).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledWith(cancelError);
    }
  );
});

describe("Node response cancellation reporting", () => {
  test("logs reporter failures during suppressed body cancellation without preventing the response", async () => {
    const cancelError = new TestIoError("cancel failed");
    const reporterError = new TestApplicationError("reporter failed");
    const { cancelSpy, response } = responseWithRejectingCancelableBody(
      200,
      cancelError
    );
    const app = typeweaverAppReturning(response, {
      onError: () => {
        throw reporterError;
      },
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    try {
      const handler = nodeAdapter(app);
      const req = createMockIncomingMessage("HEAD", "/resource");
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);
      await Promise.resolve();

      expect(res.writtenStatus).toBe(200);
      expect(res.writtenBodyBuffer).toEqual(Buffer.alloc(0));
      expect(cancelSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        "TypeweaverApp: onError callback threw while handling error",
        { onErrorFailure: reporterError, originalError: cancelError }
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });

  test("writes duplicate non-cookie response headers with Fetch header joining", async () => {
    const headers = new Headers();
    headers.append("x-cache", "hit");
    headers.append("x-cache", "stale");

    const app = fakeAppReturning(new Response("ok", { headers }));

    const handler = nodeAdapter(app);
    const req = createMockIncomingMessage("GET", "/resource");
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenHeaders["x-cache"]).toBe("hit, stale");
  });
});

describe("error handling", () => {
  test("returns 500 JSON when app.fetch rejects", async () => {
    const app = fakeAppRejecting(new TestApplicationError("boom"));
    vi.spyOn(console, "error").mockImplementation(vi.fn());

    const handler = nodeAdapter(app);
    const req = createMockIncomingMessage("GET", "/");
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenStatus).toBe(500);
    const parsed = JSON.parse(res.writtenBody) as Record<string, unknown>;
    expect(parsed).toEqual({
      code: internalServerErrorDefaultError.code,
      message: internalServerErrorDefaultError.message,
    });
  });

  test("omits the error body for HEAD requests when app.fetch rejects", async () => {
    const app = fakeAppRejecting(new TestApplicationError("boom"));
    vi.spyOn(console, "error").mockImplementation(vi.fn());

    const handler = nodeAdapter(app);
    const req = createMockIncomingMessage("HEAD", "/");
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenStatus).toBe(500);
    expect(res.writtenBodyBuffer).toEqual(Buffer.alloc(0));
  });

  test("returns 500 JSON when absolute URL construction fails", async () => {
    const onError = vi.fn();
    const app = new TypeweaverApp({ onError });

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
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(TypeError);
  });
});
