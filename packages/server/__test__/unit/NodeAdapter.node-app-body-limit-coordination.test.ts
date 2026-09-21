import {
  notFoundDefaultError,
  payloadTooLargeDefaultError,
} from "@rexeus/typeweaver-core";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createNodeBodyLimitPolicy } from "../../src/lib/BodyLimitPolicy.js";
import { PayloadTooLargeError } from "../../src/lib/errors/index.js";
import { nodeAdapter } from "../../src/lib/NodeAdapter.js";
import { TypeweaverApp } from "../../src/lib/TypeweaverApp.js";
import { setTypeweaverAppRuntimeContext } from "../../src/lib/TypeweaverInternals.js";
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Node app body limit coordination", () => {
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
});

describe("Node body limits for bodyless methods", () => {
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
