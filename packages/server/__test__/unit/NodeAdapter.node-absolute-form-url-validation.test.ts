import { IncomingMessage } from "node:http";
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

function captureDrainedRequestBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => {
    chunks.push(Buffer.from(chunk));
  });

  return new Promise<string>(resolve => {
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString());
    });
  });
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

describe("Node absolute-form URL validation", () => {
  test("returns bad request for absolute-form request URLs without a host header", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "GET",
      url: "http://api.example.test:8080/items?filter=active",
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

  test("accepts absolute-form request URLs when the host header matches", async () => {
    const { request, res } = await invokeNodeAdapter({
      method: "GET",
      url: "http://api.example.test:8080/items?filter=active",
      headers: { host: "api.example.test:8080" },
      response: new Response(""),
    });

    expect(res.writtenStatus).toBe(200);
    expect(expectRequest(request).url).toBe(
      "http://api.example.test:8080/items?filter=active"
    );
  });

  test("accepts HTTPS absolute-form request URLs with a default-port host header", async () => {
    const { request, res } = await invokeNodeAdapter({
      method: "GET",
      url: "https://api.example.test/items",
      headers: { host: "api.example.test" },
      response: new Response(""),
    });

    expect(res.writtenStatus).toBe(200);
    expect(expectRequest(request).url).toBe("https://api.example.test/items");
  });

  test("accepts HTTPS absolute-form request URLs when the host header matches a non-default port", async () => {
    const { request, res } = await invokeNodeAdapter({
      method: "GET",
      url: "https://api.example.test:8443/items",
      headers: { host: "api.example.test:8443" },
      response: new Response(""),
    });

    expect(res.writtenStatus).toBe(200);
    expect(expectRequest(request).url).toBe(
      "https://api.example.test:8443/items"
    );
  });
});

describe("Node absolute-form authority matching", () => {
  test("accepts absolute-form request URLs when the host header matches case-insensitively", async () => {
    const { request, res } = await invokeNodeAdapter({
      method: "GET",
      url: "http://api.example.test:8080/items",
      headers: { host: "API.EXAMPLE.TEST:8080" },
      response: new Response(""),
    });

    expect(res.writtenStatus).toBe(200);
    expect(expectRequest(request).url).toBe(
      "http://api.example.test:8080/items"
    );
  });

  test("returns bad request for absolute-form request URLs when the host header mismatches", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "GET",
      url: "http://api.example.test:8080/items?filter=active",
      headers: { host: "other.example.test:8080" },
      response: new Response(""),
    });

    expect(res.writtenStatus).toBe(400);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: badRequestDefaultError.code,
      message: badRequestDefaultError.message,
    });
    expect(receivedRequests).toHaveLength(0);
  });

  test("returns bad request for HTTPS absolute-form request URLs when the host header uses the wrong effective port", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "GET",
      url: "https://api.example.test/items",
      headers: { host: "api.example.test:80" },
      response: new Response(""),
    });

    expect(res.writtenStatus).toBe(400);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: badRequestDefaultError.code,
      message: badRequestDefaultError.message,
    });
    expect(receivedRequests).toHaveLength(0);
  });

  test("returns bad request for absolute-form request URLs with a malformed host header", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "GET",
      url: "http://api.example.test/items",
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

  test("forwards custom methods without normalizing case", async () => {
    const { request } = await invokeNodeAdapter({
      method: "custom",
      url: "/items/1",
      response: new Response(""),
    });

    expect(expectRequest(request).method).toBe("custom");
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
