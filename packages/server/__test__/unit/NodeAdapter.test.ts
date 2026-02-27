import { describe, expect, test, vi } from "vitest";
import { nodeAdapter } from "../../src/lib/NodeAdapter";
import { TypeweaverApp } from "../../src/lib/TypeweaverApp";
import {
  awaitResponse,
  createMockIncomingMessage,
  createMockServerResponse,
} from "../node-helpers";

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

    test("omits body for GET", async () => {
      const app = new TypeweaverApp();
      const fetchSpy = stubFetch(app, new Response(""));

      const handler = nodeAdapter(app);
      const req = createMockIncomingMessage("GET", "/items");
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
  });

  describe("error handling", () => {
    test("returns 500 JSON when app.fetch rejects", async () => {
      const app = new TypeweaverApp();
      vi.spyOn(app, "fetch").mockRejectedValue(new Error("boom"));
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(vi.fn());

      const handler = nodeAdapter(app);
      const req = createMockIncomingMessage("GET", "/");
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      expect(res.writtenStatus).toBe(500);
      const parsed = JSON.parse(res.writtenBody);
      expect(parsed).toEqual({
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      });

      consoleSpy.mockRestore();
    });

    test("logs error to console.error", async () => {
      const app = new TypeweaverApp();
      const error = new Error("something broke");
      vi.spyOn(app, "fetch").mockRejectedValue(error);
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(vi.fn());

      const handler = nodeAdapter(app);
      const req = createMockIncomingMessage("GET", "/");
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      expect(consoleSpy).toHaveBeenCalledWith(error);

      consoleSpy.mockRestore();
    });
  });
});
