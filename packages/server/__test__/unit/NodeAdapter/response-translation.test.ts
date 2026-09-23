import {
  TestApplicationError,
  TestAssertionError,
  TestIoError,
} from "test-utils";
import { afterEach, describe, expect, test, vi } from "vitest";
import { nodeAdapter } from "../../../src/lib/NodeAdapter.js";
import { TypeweaverApp } from "../../../src/lib/TypeweaverApp.js";
import {
  awaitResponse,
  createMockIncomingMessage,
  createMockServerResponse,
} from "../../node-helpers.js";
import { fakeAppReturning, fakeAppWithErrorReporter } from "./fixtures.js";

function typeweaverAppReturning(
  response: Response,
  options?: ConstructorParameters<typeof TypeweaverApp>[0]
): TypeweaverApp<Record<string, unknown>> {
  const app = new TypeweaverApp(options);
  app.fetch = async () => response;

  return app;
}

function expectBodyStream(response: Response): ReadableStream<Uint8Array> {
  const { body } = response;
  if (body === null) {
    throw new TestAssertionError("Expected the response to have a body stream");
  }
  return body;
}

function responseWithCancelableBody(status: number) {
  const response = new Response(new ReadableStream());
  Object.defineProperty(response, "status", { value: status });
  const cancelSpy = vi
    .spyOn(expectBodyStream(response), "cancel")
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
    .spyOn(expectBodyStream(response), "cancel")
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
    .spyOn(expectBodyStream(response), "cancel")
    .mockImplementation(() => {
      throw cancelError;
    });

  return { cancelSpy, response };
}

afterEach(() => {
  vi.restoreAllMocks();
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
