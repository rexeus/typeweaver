import {
  internalServerErrorDefaultError,
  payloadTooLargeDefaultError,
} from "@rexeus/typeweaver-core";
import { describe, expect, test, vi } from "vitest";
import { PayloadTooLargeError } from "../../src/lib/Errors.js";
import { FetchApiAdapter } from "../../src/lib/FetchApiAdapter.js";
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

describe("nodeAdapter", () => {
  describe("request translation", () => {
    test("constructs URL from req.url and host header", async () => {
      const app = new TypeweaverApp();
      const fetchSpy = stubFetch(app, new Response(""));

      const handler = nodeAdapter(app);
      const req = createMockIncomingMessage("GET", "/api/users?page=2");
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      const request = fetchSpy.mock.calls[0]![0] as Request;
      expect(request.url).toBe("http://localhost:3000/api/users?page=2");
    });

    test("forwards HTTP method", async () => {
      const app = new TypeweaverApp();
      const fetchSpy = stubFetch(app, new Response(""));

      const handler = nodeAdapter(app);
      const req = createMockIncomingMessage("DELETE", "/items/1");
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      const request = fetchSpy.mock.calls[0]![0] as Request;
      expect(request.method).toBe("DELETE");
    });

    test("forwards request headers", async () => {
      const app = new TypeweaverApp();
      const fetchSpy = stubFetch(app, new Response(""));

      const handler = nodeAdapter(app);
      const req = createMockIncomingMessage("GET", "/", {
        authorization: "Bearer token",
        "x-request-id": "abc-123",
      });
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      const request = fetchSpy.mock.calls[0]![0] as Request;
      expect(request.headers.get("authorization")).toBe("Bearer token");
      expect(request.headers.get("x-request-id")).toBe("abc-123");
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
      expect(request.body).toBeNull();
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
      expect(request.body).toBeNull();
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

    test("marks stricter Node prevalidation so fetch parsing skips duplicate reads", async () => {
      const app = new TypeweaverApp({ maxBodySize: 64 });
      const readBodyWithLimitSpy = vi.spyOn(
        FetchApiAdapter.prototype as never,
        "readBodyWithLimit" as never
      );

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
      expect(readBodyWithLimitSpy).not.toHaveBeenCalled();

      readBodyWithLimitSpy.mockRestore();
    });

    test("does not return 413 for oversized GET content-length", async () => {
      const app = new TypeweaverApp();
      const fetchSpy = stubFetch(app, new Response("ok"));

      const handler = nodeAdapter(app, { maxBodySize: 1 });
      const req = createMockIncomingMessage("GET", "/items", {
        "content-length": "999",
      });
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      expect(res.writtenStatus).toBe(200);
      const request = fetchSpy.mock.calls[0]![0] as Request;
      expect(request.body).toBeNull();
    });

    test("does not return 413 for oversized HEAD content-length", async () => {
      const app = new TypeweaverApp();
      const fetchSpy = stubFetch(app, new Response("ok"));

      const handler = nodeAdapter(app, { maxBodySize: 1 });
      const req = createMockIncomingMessage("HEAD", "/items", {
        "content-length": "999",
      });
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      expect(res.writtenStatus).toBe(200);
      const request = fetchSpy.mock.calls[0]![0] as Request;
      expect(request.body).toBeNull();
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
