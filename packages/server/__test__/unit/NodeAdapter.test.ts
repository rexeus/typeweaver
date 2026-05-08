/* oxlint-disable import/max-dependencies */

import { IncomingMessage } from "node:http";
import { Socket } from "node:net";
import {
  badRequestDefaultError,
  internalServerErrorDefaultError,
  notFoundDefaultError,
  payloadTooLargeDefaultError,
} from "@rexeus/typeweaver-core";
import {
  TestApplicationError,
  TestAssertionError,
  TestIoError,
} from "test-utils";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createNodeBodyLimitPolicy } from "../../src/lib/BodyLimitPolicy.js";
import {
  PayloadTooLargeError,
  RequestBodyClosedBeforeEndError,
  RequestBodyDrainTimeoutError,
  RequestBodyReadAbortedError,
} from "../../src/lib/errors/index.js";
import { nodeAdapter } from "../../src/lib/NodeAdapter.js";
import { TypeweaverApp } from "../../src/lib/TypeweaverApp.js";
import { setTypeweaverAppRuntimeContext } from "../../src/lib/TypeweaverInternals.js";
import {
  awaitResponse,
  applyNodeRequestWireMetadata,
  createMockIncomingMessage,
  createMockServerResponse,
} from "../node-helpers.js";
import type {
  NodeRequestHeaders,
  NodeRequestWireMetadata,
} from "../node-helpers.js";

type FakeApp = TypeweaverApp<any> & {
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
): TypeweaverApp<any> {
  const app = new TypeweaverApp(options);
  app.fetch = async () => response;

  return app;
}

function responseWithCancelableBody(status: number) {
  const response = new Response(new ReadableStream());
  Object.defineProperty(response, "status", { value: status });
  const cancelSpy = vi.spyOn(response.body!, "cancel").mockResolvedValue();

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
    .spyOn(response.body!, "cancel")
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
    .spyOn(response.body!, "cancel")
    .mockImplementation(() => {
      throw cancelError;
    });

  return { cancelSpy, response };
}

function createControlledIncomingMessage(
  method: string,
  url: string | undefined,
  headers: NodeRequestHeaders = {},
  wireMetadata?: NodeRequestWireMetadata
): IncomingMessage {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = method;
  req.url = url;
  req.headers = { host: "localhost:3000", ...headers };
  applyNodeRequestWireMetadata(req, req.headers, wireMetadata);
  return req;
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

function captureDrainedRequestBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  req.on("data", chunk => {
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
    options.body,
    options.wireMetadata
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

describe("nodeAdapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

    test("falls back to root path when req.url is undefined", async () => {
      const { request } = await invokeNodeAdapter({
        method: "GET",
        url: undefined,
        response: new Response(""),
      });

      expect(expectRequest(request).url).toBe("http://localhost:3000/");
    });

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

    test("accepts origin-form URLs when headersDistinct has no host value and rawHeaders contains one host line", async () => {
      const { request, res } = await invokeNodeAdapter({
        method: "GET",
        url: "/items?filter=active",
        headers: { host: "localhost:3000" },
        wireMetadata: {
          rawHeaders: ["Host", "localhost:3000"],
          headersDistinct: {},
        },
        response: new Response(""),
      });

      expect(res.writtenStatus).toBe(200);
      expect(expectRequest(request).url).toBe(
        "http://localhost:3000/items?filter=active"
      );
    });

    test.each([
      { scenario: "double slashes", url: "//attacker.example/path" },
      { scenario: "slash then backslash", url: "/\\attacker.example/path" },
      { scenario: "double backslashes", url: "\\\\attacker.example/path" },
      { scenario: "backslash then slash", url: "\\/attacker.example/path" },
    ])(
      "returns bad request for authority-like request targets with $scenario",
      async ({ url }) => {
        const { receivedRequests, res } = await invokeNodeAdapter({
          method: "GET",
          url,
          headers: { host: "victim.example" },
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

    test("dispatches OPTIONS asterisk-form request targets as an app-visible wildcard URL", async () => {
      const { request, receivedRequests, res } = await invokeNodeAdapter({
        method: "OPTIONS",
        url: "*",
        headers: { host: "localhost:3000" },
        response: new Response(null, { status: 204 }),
      });

      expect(res.writtenStatus).toBe(204);
      expect(expectRequest(request).url).toBe("http://localhost:3000/*");
      expect(expectRequest(request).method).toBe("OPTIONS");
      expect(receivedRequests).toHaveLength(1);
    });

    test("returns bad request for OPTIONS asterisk-form request targets when rawHeaders contains duplicate host lines", async () => {
      const { receivedRequests, res } = await invokeNodeAdapter({
        method: "OPTIONS",
        url: "*",
        headers: { host: "localhost:3000" },
        wireMetadata: {
          rawHeaders: ["Host", "localhost:3000", "hOSt", "localhost:3001"],
        },
        response: new Response(null, { status: 204 }),
      });

      expect(res.writtenStatus).toBe(400);
      expect(JSON.parse(res.writtenBody)).toEqual({
        code: badRequestDefaultError.code,
        message: badRequestDefaultError.message,
      });
      expect(receivedRequests).toHaveLength(0);
    });

    test("returns bad request for non-OPTIONS asterisk-form request targets", async () => {
      const { receivedRequests, res } = await invokeNodeAdapter({
        method: "GET",
        url: "*",
        headers: { host: "localhost:3000" },
        response: new Response(""),
      });

      expect(res.writtenStatus).toBe(400);
      expect(JSON.parse(res.writtenBody)).toEqual({
        code: badRequestDefaultError.code,
        message: badRequestDefaultError.message,
      });
      expect(receivedRequests).toHaveLength(0);
    });

    test("drains authority-like request bodies after returning bad request", async () => {
      const app = fakeAppReturning(new Response("ok"));

      const handler = nodeAdapter(app, { maxBodySize: 5 });
      const req = createControlledIncomingMessage(
        "POST",
        "/\\attacker.example/path",
        {
          "content-length": "5",
          host: "victim.example",
        }
      );
      const drainedBody = captureDrainedRequestBody(req);
      const drainStarted = waitForRequestStreamToResume(req);
      const res = createMockServerResponse(req);
      const responseFinished = awaitResponse(res);

      handler(req, res);
      await responseFinished;
      await drainStarted;
      req.push(Buffer.from("hello"));
      req.push(null);

      expect(res.writtenStatus).toBe(400);
      expect(JSON.parse(res.writtenBody)).toEqual({
        code: badRequestDefaultError.code,
        message: badRequestDefaultError.message,
      });
      expect(await drainedBody).toBe("hello");
      expect(app.receivedRequests).toHaveLength(0);
    });

    test("drains malformed host request bodies after returning bad request", async () => {
      const app = fakeAppReturning(new Response("ok"));

      const handler = nodeAdapter(app, { maxBodySize: 5 });
      const req = createControlledIncomingMessage("POST", "/items", {
        "content-length": "5",
        host: "bad host",
      });
      const drainedBody = captureDrainedRequestBody(req);
      const drainStarted = waitForRequestStreamToResume(req);
      const res = createMockServerResponse(req);
      const responseFinished = awaitResponse(res);

      handler(req, res);
      await responseFinished;
      await drainStarted;
      req.push(Buffer.from("hello"));
      req.push(null);

      expect(res.writtenStatus).toBe(400);
      expect(JSON.parse(res.writtenBody)).toEqual({
        code: badRequestDefaultError.code,
        message: badRequestDefaultError.message,
      });
      expect(await drainedBody).toBe("hello");
      expect(app.receivedRequests).toHaveLength(0);
    });

    test("destroys malformed host chunked bodies that exceed the cleanup limit", async () => {
      const app = fakeAppReturning(new Response("ok"));

      const handler = nodeAdapter(app, { maxBodySize: 4 });
      const req = createControlledIncomingMessage("POST", "/items", {
        host: "bad host",
        "transfer-encoding": "chunked",
      });
      const drainStarted = waitForRequestStreamToResume(req);
      const res = createMockServerResponse(req);
      const responseFinished = awaitResponse(res);

      handler(req, res);
      await responseFinished;
      await drainStarted;
      req.push(Buffer.from("hello"));

      expect(res.writtenStatus).toBe(400);
      expect(JSON.parse(res.writtenBody)).toEqual({
        code: badRequestDefaultError.code,
        message: badRequestDefaultError.message,
      });
      expect(req.destroyed).toBe(true);
      expect(app.receivedRequests).toHaveLength(0);
    });

    test("destroys malformed host request bodies immediately when content-length exceeds the cleanup limit", async () => {
      const app = fakeAppReturning(new Response("ok"));

      const handler = nodeAdapter(app, { maxBodySize: 4 });
      const req = createControlledIncomingMessage("POST", "/items", {
        "content-length": "999",
        host: "bad host",
      });
      const res = createMockServerResponse(req);
      const responseFinished = awaitResponse(res);

      handler(req, res);
      await responseFinished;

      expect(res.writtenStatus).toBe(400);
      expect(JSON.parse(res.writtenBody)).toEqual({
        code: badRequestDefaultError.code,
        message: badRequestDefaultError.message,
      });
      expect(req.destroyed).toBe(true);
      expect(app.receivedRequests).toHaveLength(0);
    });

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

      const request = app.receivedRequests[0]!;
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

      const request = app.receivedRequests[0]!;
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

      const request = app.receivedRequests[0]!;
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

      const request = app.receivedRequests[0]!;
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

        const request = app.receivedRequests[0]!;
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

      const request = app.receivedRequests[0]!;
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
      const app = fakeAppReturning(
        new Response('{"ok":true}', { status: 200 })
      );

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

    test("preserves multiple Set-Cookie headers individually", async () => {
      const headers = new Headers();
      headers.append("set-cookie", "session=abc; Path=/; HttpOnly");
      headers.append("set-cookie", "theme=dark; Path=/");
      headers.append("content-type", "text/html");

      const app = fakeAppReturning(
        new Response("ok", { status: 200, headers })
      );

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
      const app = fakeAppReturning(
        new Response("body that must not be written")
      );

      const handler = nodeAdapter(app);
      const req = createMockIncomingMessage("HEAD", "/download");
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      expect(res.writtenStatus).toBe(200);
      expect(res.writtenBody).toBe("");
      expect(res.writtenBodyBuffer).toEqual(Buffer.alloc(0));
    });

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
        const app = fakeAppWithErrorReporter(
          fakeAppReturning(response),
          onError
        );

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
        const app = fakeAppWithErrorReporter(
          fakeAppReturning(response),
          onError
        );

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
      const parsed = JSON.parse(res.writtenBody);
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
      const parsed = JSON.parse(res.writtenBody);
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

    test("returns 413 when the actual POST body exceeds an under-declared content-length", async () => {
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
          "content-length": "1",
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

    test("accepts empty POST bodies when maxBodySize is zero", async () => {
      const app = fakeAppReturning(new Response("ok"));

      const handler = nodeAdapter(app, { maxBodySize: 0 });
      const req = createMockIncomingMessage(
        "POST",
        "/upload",
        { "content-type": "text/plain" },
        ""
      );
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      const request = app.receivedRequests[0]!;
      expect(res.writtenStatus).toBe(200);
      expect(await request.text()).toBe("");
    });

    test("rejects non-empty POST bodies when maxBodySize is zero", async () => {
      const onError = vi.fn();
      const app = fakeAppWithErrorReporter(
        fakeAppReturning(new Response("ok")),
        onError
      );

      const handler = nodeAdapter(app, { maxBodySize: 0 });
      const req = createMockIncomingMessage(
        "POST",
        "/upload",
        { "content-type": "text/plain" },
        "x"
      );
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      expect(res.writtenStatus).toBe(413);
      expect(app.receivedRequests).toHaveLength(0);
      expect(onError.mock.calls[0]?.[0]).toMatchObject({
        contentLength: 1,
        maxBodySize: 0,
      });
    });

    test("accepts a request when the first duplicate content-length value is within the limit", async () => {
      const app = fakeAppReturning(new Response("ok"));

      const handler = nodeAdapter(app, { maxBodySize: 4 });
      const req = createMockIncomingMessage(
        "POST",
        "/upload",
        {
          "content-length": ["4", "999"],
          "content-type": "text/plain",
        },
        "data"
      );
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      const request = app.receivedRequests[0]!;
      expect(res.writtenStatus).toBe(200);
      expect(await request.text()).toBe("data");
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
      req.emit("error", new TestIoError("drain failed"));
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
      const app = fakeAppReturning(new Response("ok"));

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
      const request = app.receivedRequests[0]!;
      expect(await request.text()).toBe(body);
    });

    test("accepts a body exactly at the default 1 MB limit when no maxBodySize option is provided", async () => {
      const app = fakeAppReturning(new Response("ok"));

      const body = "x".repeat(1_048_576);
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
      const request = app.receivedRequests[0]!;
      expect(await request.text()).toBe(body);
    });

    test("rejects a body one byte over the default 1 MB limit when no maxBodySize option is provided", async () => {
      const onError = vi.fn();
      const app = fakeAppWithErrorReporter(
        fakeAppReturning(new Response("ok")),
        onError
      );

      const handler = nodeAdapter(app);
      const req = createMockIncomingMessage("POST", "/upload", {
        "content-length": "1048577",
        "content-type": "text/plain",
      });
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      expect(res.writtenStatus).toBe(413);
      expect(app.receivedRequests).toHaveLength(0);
      expect(onError.mock.calls[0]?.[0]).toMatchObject({
        contentLength: 1_048_577,
        maxBodySize: 1_048_576,
      });
    });

    test("uses app maxBodySize when adapter option is omitted", async () => {
      const app = new TypeweaverApp({ maxBodySize: 8, onError: vi.fn() });

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

    test("returns the app 413 when the adapter body limit is looser than the app body limit", async () => {
      const onError = vi.fn();
      const app = new TypeweaverApp({ maxBodySize: 8, onError });

      const handler = nodeAdapter(app, { maxBodySize: 16 });
      const req = createMockIncomingMessage(
        "POST",
        "/upload",
        { "content-type": "text/plain" },
        "x".repeat(12)
      );
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      expect(res.writtenStatus).toBe(413);
      expect(JSON.parse(res.writtenBody)).toEqual({
        code: payloadTooLargeDefaultError.code,
        message: payloadTooLargeDefaultError.message,
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(PayloadTooLargeError);
    });

    test("returns 413 for oversized GET content-length without dispatching to the app", async () => {
      const { receivedRequests, res } = await invokeNodeAdapter({
        method: "GET",
        url: "/items",
        headers: { "content-length": "999" },
        response: new Response("ok"),
        adapterOptions: { maxBodySize: 1 },
      });

      expect(res.writtenStatus).toBe(413);
      expect(receivedRequests).toHaveLength(0);
    });

    test("returns 413 for oversized GET bodies identified only by transfer-encoding", async () => {
      const onError = vi.fn();
      const app = fakeAppWithErrorReporter(
        fakeAppReturning(new Response("ok")),
        onError
      );

      const handler = nodeAdapter(app, { maxBodySize: 4 });
      const req = createMockIncomingMessage(
        "GET",
        "/items",
        { "transfer-encoding": "chunked" },
        "hello"
      );
      const res = createMockServerResponse(req);

      handler(req, res);
      await awaitResponse(res);

      expect(res.writtenStatus).toBe(413);
      expect(app.receivedRequests).toHaveLength(0);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(PayloadTooLargeError);
    });

    test("returns 413 for oversized HEAD content-length without dispatching to the app", async () => {
      const { receivedRequests, res } = await invokeNodeAdapter({
        method: "HEAD",
        url: "/items",
        headers: { "content-length": "999" },
        response: new Response("ok"),
        adapterOptions: { maxBodySize: 1 },
      });

      expect(res.writtenStatus).toBe(413);
      expect(res.writtenBodyBuffer).toEqual(Buffer.alloc(0));
      expect(receivedRequests).toHaveLength(0);
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
