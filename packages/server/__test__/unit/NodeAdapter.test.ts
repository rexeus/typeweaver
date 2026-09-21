import { badRequestDefaultError } from "@rexeus/typeweaver-core";
import { TestAssertionError } from "test-utils";
import { afterEach, describe, expect, test, vi } from "vitest";
import { nodeAdapter } from "../../src/lib/NodeAdapter.js";
import { TypeweaverApp } from "../../src/lib/TypeweaverApp.js";
import {
  awaitResponse,
  createMockIncomingMessage,
  createMockServerResponse,
} from "../node-helpers.js";
import type {
  NodeRequestHeaders,
  NodeRequestWireMetadata,
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

type InvokeNodeAdapterOptions = {
  readonly app?: Parameters<typeof nodeAdapter>[0];
  readonly response?: Response;
  readonly method: string;
  readonly url: string | undefined;
  readonly headers?: NodeRequestHeaders;
  readonly body?: string | Buffer;
  readonly wireMetadata?: NodeRequestWireMetadata;
  readonly adapterOptions?: Parameters<typeof nodeAdapter>[1];
};

async function invokeNodeAdapter(options: InvokeNodeAdapterOptions) {
  const app =
    options.app ?? fakeAppReturning(options.response ?? new Response(""));
  const handler = nodeAdapter(app, options.adapterOptions);
  const req = createMockIncomingMessage(
    options.method,
    options.url,
    options.headers,
    {
      body: options.body,
      wireMetadata: options.wireMetadata,
    }
  );
  const res = createMockServerResponse(req);

  handler(req, res);
  await awaitResponse(res);

  const receivedRequests = (app as unknown as Partial<FakeApp>)
    .receivedRequests;
  const request = receivedRequests?.[0];
  return { app, request, receivedRequests, res };
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

describe("Node origin-form Host validation", () => {
  test("returns bad request for origin-form URLs without a host header", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "GET",
      url: "/items?filter=active",
      headers: { host: undefined },
      response: new Response(""),
    });

    expect(res.writtenStatus).toBe(400);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: badRequestDefaultError.code,
      message: badRequestDefaultError.message,
    });
    expect(receivedRequests).toHaveLength(0);
  });

  test("returns bad request for origin-form URLs with a malformed host header", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "GET",
      url: "/items?filter=active",
      headers: { host: "bad host" },
      response: new Response(""),
    });

    expect(res.writtenStatus).toBe(400);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: badRequestDefaultError.code,
      message: badRequestDefaultError.message,
    });
    expect(receivedRequests).toHaveLength(0);
  });

  test("returns bad request for origin-form URLs with an empty host header", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "GET",
      url: "/items?filter=active",
      headers: { host: "" },
      response: new Response(""),
    });

    expect(res.writtenStatus).toBe(400);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: badRequestDefaultError.code,
      message: badRequestDefaultError.message,
    });
    expect(receivedRequests).toHaveLength(0);
  });
});

describe("Node origin-form authority validation", () => {
  test.each([
    { headers: { host: undefined }, scenario: "a missing host header" },
    { headers: { host: "bad host" }, scenario: "a malformed host header" },
  ])(
    "returns bad request without a body for HEAD requests with $scenario",
    async ({ headers }) => {
      const { receivedRequests, res } = await invokeNodeAdapter({
        method: "HEAD",
        url: "/items?filter=active",
        headers,
        response: new Response(""),
      });

      expect(res.writtenStatus).toBe(400);
      expect(res.writtenBodyBuffer).toEqual(Buffer.alloc(0));
      expect(receivedRequests).toHaveLength(0);
    }
  );

  test.each([
    { host: " localhost:3000", scenario: "leading whitespace" },
    { host: "localhost:3000 ", scenario: "trailing whitespace" },
  ])(
    "returns bad request for origin-form URLs when the host has $scenario",
    async ({ host }) => {
      const { receivedRequests, res } = await invokeNodeAdapter({
        method: "GET",
        url: "/items?filter=active",
        headers: { host },
        response: new Response(""),
      });

      expect(res.writtenStatus).toBe(400);
      expect(JSON.parse(res.writtenBody)).toEqual({
        code: badRequestDefaultError.code,
        message: badRequestDefaultError.message,
      });
      expect(receivedRequests).toHaveLength(0);
    }
  );

  test.each([
    { host: "localhost:3000/path", scenario: "a path" },
    { host: "localhost:3000?x=1", scenario: "a query string" },
    { host: "user@localhost:3000", scenario: "userinfo" },
    { host: "localhost:3000#hash", scenario: "a fragment" },
  ])(
    "returns bad request for origin-form URLs when the host contains $scenario",
    async ({ host }) => {
      const { receivedRequests, res } = await invokeNodeAdapter({
        method: "GET",
        url: "/items?filter=active",
        headers: { host },
        response: new Response(""),
      });

      expect(res.writtenStatus).toBe(400);
      expect(JSON.parse(res.writtenBody)).toEqual({
        code: badRequestDefaultError.code,
        message: badRequestDefaultError.message,
      });
      expect(receivedRequests).toHaveLength(0);
    }
  );
});

describe("Node duplicate Host validation", () => {
  test("returns bad request for origin-form URLs with duplicate host headers", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "GET",
      url: "/items?filter=active",
      headers: { host: ["localhost:3000", "localhost:3001"] },
      response: new Response(""),
    });

    expect(res.writtenStatus).toBe(400);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: badRequestDefaultError.code,
      message: badRequestDefaultError.message,
    });
    expect(receivedRequests).toHaveLength(0);
  });
});

describe("Node Host provenance validation", () => {
  test.each([
    { scenario: "origin-form URLs", url: "/items?filter=active" },
    {
      scenario: "absolute-form URLs",
      url: "http://localhost:3000/items?filter=active",
    },
  ])(
    "returns bad request for $scenario when rawHeaders contains duplicate host lines",
    async ({ url }) => {
      const { receivedRequests, res } = await invokeNodeAdapter({
        method: "GET",
        url,
        headers: { host: "localhost:3000" },
        wireMetadata: {
          rawHeaders: ["Host", "localhost:3000", "hOSt", "localhost:3001"],
        },
        response: new Response(""),
      });

      expect(res.writtenStatus).toBe(400);
      expect(JSON.parse(res.writtenBody)).toEqual({
        code: badRequestDefaultError.code,
        message: badRequestDefaultError.message,
      });
      expect(receivedRequests).toHaveLength(0);
    }
  );

  test("returns bad request for origin-form URLs when headersDistinct contains duplicate host values", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "GET",
      url: "/items?filter=active",
      headers: { host: "localhost:3000" },
      wireMetadata: {
        rawHeaders: ["Host", "localhost:3000"],
        headersDistinct: { host: ["localhost:3000", "localhost:3001"] },
      },
      response: new Response(""),
    });

    expect(res.writtenStatus).toBe(400);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: badRequestDefaultError.code,
      message: badRequestDefaultError.message,
    });
    expect(receivedRequests).toHaveLength(0);
  });

  test("returns bad request for absolute-form URLs when headersDistinct contains duplicate host values", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "GET",
      url: "http://localhost:3000/items?filter=active",
      headers: { host: "localhost:3000" },
      wireMetadata: {
        rawHeaders: ["Host", "localhost:3000"],
        headersDistinct: { host: ["localhost:3000", "localhost:3001"] },
      },
      response: new Response(""),
    });

    expect(res.writtenStatus).toBe(400);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: badRequestDefaultError.code,
      message: badRequestDefaultError.message,
    });
    expect(receivedRequests).toHaveLength(0);
  });
});
