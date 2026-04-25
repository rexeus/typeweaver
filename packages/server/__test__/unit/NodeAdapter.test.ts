import { IncomingMessage } from "node:http";
import { Socket } from "node:net";
import {
  internalServerErrorDefaultError,
  notFoundDefaultError,
  payloadTooLargeDefaultError,
} from "@rexeus/typeweaver-core";
import { describe, expect, test, vi } from "vitest";
import {
  PayloadTooLargeError,
  RequestBodyDrainTimeoutError,
} from "../../src/lib/Errors.js";
import { nodeAdapter } from "../../src/lib/NodeAdapter.js";
import { TypeweaverApp } from "../../src/lib/TypeweaverApp.js";
import {
  awaitResponse,
  createMockIncomingMessage,
  createMockServerResponse,
} from "../node-helpers.js";

function stubFetch(app: TypeweaverApp, response: Response) {
  return vi.spyOn(app, "fetch").mockResolvedValue(response);
}

function createControlledIncomingMessage(
  method: string,
  url: string,
  headers: Record<string, string> = {}
): IncomingMessage {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = method;
  req.url = url;
  req.headers = { host: "localhost:3000", ...headers };
  return req;
}

function waitForSkippedBodyDrain(req: IncomingMessage): Promise<void> {
  return new Promise<void>(resolve => {
    const handleNewListener = (eventName: string | symbol): void => {
      if (eventName !== "error") {
        return;
      }

      req.off("newListener", handleNewListener);
      resolve();
    };

    req.on("newListener", handleNewListener);
  });
}

type InvokeNodeAdapterOptions = {
  readonly app?: TypeweaverApp;
  readonly response?: Response;
  readonly method: string;
  readonly url: string;
  readonly headers?: Record<string, string>;
  readonly body?: string | Buffer;
  readonly adapterOptions?: Parameters<typeof nodeAdapter>[1];
};

async function invokeNodeAdapter(options: InvokeNodeAdapterOptions) {
  const app = options.app ?? new TypeweaverApp();
  const fetchSpy =
    options.response !== undefined
      ? stubFetch(app, options.response)
      : undefined;
  const handler = nodeAdapter(app, options.adapterOptions);
  const req = createMockIncomingMessage(
    options.method,
    options.url,
    options.headers,
    options.body
  );
  const res = createMockServerResponse(req);

  handler(req, res);
  await awaitResponse(res);

  const request = fetchSpy?.mock.calls[0]?.[0] as Request | undefined;
  return { fetchSpy, request, res };
}

function expectRequest(request: Request | undefined): Request {
  if (request === undefined) {
    throw new Error("Expected app.fetch to receive a Request");
  }

  return request;
}

describe("nodeAdapter", () => {
  describe("request translation", () => {
    test("constructs URL from req.url and host header", async () => {
      const { request } = await invokeNodeAdapter({
        method: "GET",
        url: "/api/users?page=2",
        response: new Response(""),
      });

      expect(expectRequest(request).url).toBe(
        "http://localhost:3000/api/users?page=2"
      );
    });

    test("forwards HTTP method", async () => {
      const { request } = await invokeNodeAdapter({
        method: "DELETE",
        url: "/items/1",
        response: new Response(""),
      });

      expect(expectRequest(request).method).toBe("DELETE");
    });

    test("forwards request headers", async () => {
      const { request } = await invokeNodeAdapter({
        method: "GET",
        url: "/",
        headers: {
          authorization: "Bearer token",
          "x-request-id": "abc-123",
        },
        response: new Response(""),
      });

      expect(expectRequest(request).headers.get("authorization")).toBe(
        "Bearer token"
      );
      expect(expectRequest(request).headers.get("x-request-id")).toBe(
        "abc-123"
      );
    });

    test("forwards body for POST", async () => {
      const app = new TypeweaverApp();
      const fetchSpy = stubFetch(app, new Response(""));

      const handler = nodeAdapter(app);
      const body = JSON.stringify({ name: "Jane" });
      const req = createMockIncomingMessage(
        "POST",
        "/users",
        { "content-type": "application/json" },
        body
      );
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      const request = fetchSpy.mock.calls[0]![0] as Request;
      expect(await request.text()).toBe(body);
    });

    test("preserves binary request body without corruption", async () => {
      const app = new TypeweaverApp();
      const fetchSpy = stubFetch(app, new Response(""));

      const handler = nodeAdapter(app);
      const binaryBody = Buffer.from([
        0x00, 0x01, 0x80, 0xff, 0xfe, 0x89, 0x50, 0x4e, 0x47,
      ]);
      const req = createMockIncomingMessage(
        "POST",
        "/upload",
        { "content-type": "application/octet-stream" },
        binaryBody
      );
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      const request = fetchSpy.mock.calls[0]![0] as Request;
      const receivedBytes = Buffer.from(await request.arrayBuffer());
      expect(receivedBytes).toEqual(binaryBody);
    });

    test("skips body collection for GET requests", async () => {
      const app = new TypeweaverApp();
      const fetchSpy = stubFetch(app, new Response(""));

      const handler = nodeAdapter(app);
      const req = createMockIncomingMessage(
        "GET",
        "/items",
        { "content-length": "5" },
        "hello"
      );
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      const request = fetchSpy.mock.calls[0]![0] as Request;
      expect(expectRequest(request).body).toBeNull();
    });

    test("drains skipped GET request bodies", async () => {
      const handler = nodeAdapter(new TypeweaverApp());
      const req = createMockIncomingMessage(
        "GET",
        "/items",
        { "content-length": "5" },
        "hello"
      );
      const chunks: Buffer[] = [];
      req.on("data", chunk => {
        chunks.push(Buffer.from(chunk));
      });
      const endListener = vi.fn();
      req.on("end", endListener);
      const endPromise = new Promise<void>(resolve => {
        req.on("end", () => resolve());
      });
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);
      await endPromise;

      expect(Buffer.concat(chunks).toString()).toBe("hello");
      expect(endListener).toHaveBeenCalledTimes(1);
    });

    test("writes the app response when skipped GET body drain emits an error", async () => {
      const onError = vi.fn();
      const app = new TypeweaverApp({ onError });

      const handler = nodeAdapter(app);
      const req = createControlledIncomingMessage("GET", "/items", {
        "content-length": "5",
      });
      const drainStarted = waitForSkippedBodyDrain(req);
      const res = createMockServerResponse(req);
      const responseFinished = awaitResponse(res);

      handler(req, res);
      await drainStarted;
      req.push(Buffer.from("hello"));
      req.emit("error", new Error("drain failed"));
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
      const fetchSpy = stubFetch(app, new Response("ok"));

      const handler = nodeAdapter(app, { maxBodySize: 4 });
      const req = createControlledIncomingMessage("GET", "/items", {
        "content-length": "4",
      });
      const destroySpy = vi.spyOn(req, "destroy");
      const drainStarted = waitForSkippedBodyDrain(req);
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
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(destroySpy).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(PayloadTooLargeError);

      req.push(Buffer.from("again"));

      expect(destroySpy).toHaveBeenCalledTimes(1);
      expect(req.destroyed).toBe(true);
    });

    test("returns 413 when skipped GET body drain times out before dispatching to the app", async () => {
      vi.useFakeTimers();
      try {
        const onError = vi.fn();
        const app = new TypeweaverApp({ onError });
        const fetchSpy = stubFetch(app, new Response("ok"));

        const handler = nodeAdapter(app, { maxBodySize: 4 });
        const req = createControlledIncomingMessage("GET", "/items", {
          "content-length": "4",
        });
        const destroySpy = vi.spyOn(req, "destroy");
        const drainStarted = waitForSkippedBodyDrain(req);
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
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(destroySpy).not.toHaveBeenCalled();
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

        expect(destroySpy).toHaveBeenCalledTimes(1);
        expect(req.destroyed).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    test("omits body for HEAD", async () => {
      const app = new TypeweaverApp();
      const fetchSpy = stubFetch(app, new Response(""));

      const handler = nodeAdapter(app);
      const req = createMockIncomingMessage("HEAD", "/items");
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      const request = fetchSpy.mock.calls[0]![0] as Request;
      expect(expectRequest(request).body).toBeNull();
    });
  });

  describe("response translation", () => {
    test("writes status code", async () => {
      const app = new TypeweaverApp();
      stubFetch(app, new Response("", { status: 201 }));

      const handler = nodeAdapter(app);
      const req = createMockIncomingMessage("GET", "/");
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      expect(res.writtenStatus).toBe(201);
    });

    test("writes response headers", async () => {
      const app = new TypeweaverApp();
      stubFetch(
        app,
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
      const app = new TypeweaverApp();
      stubFetch(app, new Response('{"ok":true}', { status: 200 }));

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
      const app = new TypeweaverApp();
      stubFetch(
        app,
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

    test("preserves multiple Set-Cookie headers individually", async () => {
      const headers = new Headers();
      headers.append("set-cookie", "session=abc; Path=/; HttpOnly");
      headers.append("set-cookie", "theme=dark; Path=/");
      headers.append("content-type", "text/html");

      const app = new TypeweaverApp();
      stubFetch(app, new Response("ok", { status: 200, headers }));

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
  });

  describe("error handling", () => {
    test("returns 500 JSON when app.fetch rejects", async () => {
      const app = new TypeweaverApp();
      vi.spyOn(app, "fetch").mockRejectedValue(new Error("boom"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

      const handler = nodeAdapter(app);
      const req = createMockIncomingMessage("GET", "/");
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      expect(res.writtenStatus).toBe(500);
      const parsed = JSON.parse(res.writtenBody);
      expect(parsed).toEqual({
        code: internalServerErrorDefaultError.code,
        message: internalServerErrorDefaultError.message,
      });

      consoleSpy.mockRestore();
    });

    test("logs error to console.error", async () => {
      const app = new TypeweaverApp();
      const error = new Error("something broke");
      vi.spyOn(app, "fetch").mockRejectedValue(error);
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

      const handler = nodeAdapter(app);
      const req = createMockIncomingMessage("GET", "/");
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      expect(consoleSpy).toHaveBeenCalledWith(error);

      consoleSpy.mockRestore();
    });
  });

  describe("body size enforcement", () => {
    test("returns 413 when body exceeds maxBodySize", async () => {
      const app = new TypeweaverApp({ onError: vi.fn() });
      stubFetch(app, new Response(""));

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
      const parsed = JSON.parse(res.writtenBody);
      expect(parsed).toEqual({
        code: payloadTooLargeDefaultError.code,
        message: payloadTooLargeDefaultError.message,
      });
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
      req.emit("error", new Error("drain failed"));
      req.push(null);

      expect(res.writtenStatus).toBe(413);
      expect(JSON.parse(res.writtenBody)).toEqual({
        code: payloadTooLargeDefaultError.code,
        message: payloadTooLargeDefaultError.message,
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(PayloadTooLargeError);
    });

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
      const app = new TypeweaverApp();
      const fetchSpy = stubFetch(app, new Response("ok"));

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
      const request = fetchSpy.mock.calls[0]![0] as Request;
      expect(await request.text()).toBe(body);
    });

    test("uses default 1 MB limit when no maxBodySize option provided", async () => {
      const app = new TypeweaverApp();
      const fetchSpy = stubFetch(app, new Response("ok"));

      const body = "x".repeat(1024);
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
      const request = fetchSpy.mock.calls[0]![0] as Request;
      expect(await request.text()).toBe(body);
    });

    test("uses app maxBodySize when adapter option is omitted", async () => {
      const app = new TypeweaverApp({ maxBodySize: 8, onError: vi.fn() });
      stubFetch(app, new Response("ok"));

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
      const parsed = JSON.parse(res.writtenBody);
      expect(parsed).toEqual({
        code: payloadTooLargeDefaultError.code,
        message: payloadTooLargeDefaultError.message,
      });
    });

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

    test("returns 413 for oversized GET content-length without dispatching to the app", async () => {
      const { fetchSpy, res } = await invokeNodeAdapter({
        method: "GET",
        url: "/items",
        headers: { "content-length": "999" },
        response: new Response("ok"),
        adapterOptions: { maxBodySize: 1 },
      });

      expect(res.writtenStatus).toBe(413);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    test("returns 413 for oversized HEAD content-length without dispatching to the app", async () => {
      const { fetchSpy, res } = await invokeNodeAdapter({
        method: "HEAD",
        url: "/items",
        headers: { "content-length": "999" },
        response: new Response("ok"),
        adapterOptions: { maxBodySize: 1 },
      });

      expect(res.writtenStatus).toBe(413);
      expect(fetchSpy).not.toHaveBeenCalled();
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
});
