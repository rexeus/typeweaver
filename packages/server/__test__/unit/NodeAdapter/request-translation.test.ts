import { afterEach, describe, expect, test, vi } from "vitest";
import { nodeAdapter } from "../../../src/lib/NodeAdapter.js";
import { TypeweaverApp } from "../../../src/lib/TypeweaverApp.js";
import {
  awaitResponse,
  createMockIncomingMessage,
  createMockServerResponse,
} from "../../node-helpers.js";
import {
  captureDrainedRequestBody,
  expectRequest,
  fakeAppReturning,
  invokeNodeAdapter,
} from "./fixtures.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Node request URL and method translation", () => {
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
    expect(expectRequest(request).headers.get("x-request-id")).toBe("abc-123");
  });

  test("falls back to root path when req.url is undefined", async () => {
    const { request } = await invokeNodeAdapter({
      method: "GET",
      url: undefined,
      response: new Response(""),
    });

    expect(expectRequest(request).url).toBe("http://localhost:3000/");
  });
});

describe("Node request header translation", () => {
  test("joins duplicate Cookie request headers with semicolon separators", async () => {
    const { request } = await invokeNodeAdapter({
      method: "GET",
      url: "/",
      headers: {
        cookie: ["session=abc", "theme=dark"],
      },
      response: new Response(""),
    });

    expect(expectRequest(request).headers.get("cookie")).toBe(
      "session=abc; theme=dark"
    );
  });

  test("joins duplicate non-cookie request headers with comma separators", async () => {
    const { request } = await invokeNodeAdapter({
      method: "GET",
      url: "/",
      headers: {
        "x-feature": ["one", "two"],
      },
      response: new Response(""),
    });

    expect(expectRequest(request).headers.get("x-feature")).toBe("one, two");
  });

  test("omits request headers whose value is undefined", async () => {
    const { request } = await invokeNodeAdapter({
      method: "GET",
      url: "/",
      headers: {
        "x-skip": undefined,
      },
      response: new Response(""),
    });

    expect(expectRequest(request).headers.get("x-skip")).toBeNull();
  });
});

describe("Node request body translation", () => {
  test("forwards body for POST", async () => {
    const app = fakeAppReturning(new Response(""));

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

    const request = app.receivedRequests[0] as Request;
    expect(await request.text()).toBe(body);
  });

  test("preserves binary request body without corruption", async () => {
    const app = fakeAppReturning(new Response(""));

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

    const request = app.receivedRequests[0] as Request;
    const receivedBytes = Buffer.from(await request.arrayBuffer());
    expect(receivedBytes).toEqual(binaryBody);
  });

  test("skips body collection for GET requests", async () => {
    const app = fakeAppReturning(new Response(""));

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

    const request = app.receivedRequests[0] as Request;
    expect(expectRequest(request).body).toBeNull();
  });

  test("dispatches bodyless GET requests without draining the request stream", async () => {
    const app = fakeAppReturning(new Response("ok"));

    const handler = nodeAdapter(app);
    const req = createMockIncomingMessage("GET", "/items");
    const resumeSpy = vi.spyOn(req, "resume");
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(res.writtenStatus).toBe(200);
    expect(app.receivedRequests).toHaveLength(1);
    expect(resumeSpy).not.toHaveBeenCalled();
  });

  test("drains skipped GET request bodies", async () => {
    const handler = nodeAdapter(new TypeweaverApp());
    const req = createMockIncomingMessage(
      "GET",
      "/items",
      { "content-length": "5" },
      "hello"
    );
    const drainedBody = captureDrainedRequestBody(req);
    const res = createMockServerResponse(req);

    handler(req, res);
    await awaitResponse(res);

    expect(await drainedBody).toBe("hello");
  });
});
