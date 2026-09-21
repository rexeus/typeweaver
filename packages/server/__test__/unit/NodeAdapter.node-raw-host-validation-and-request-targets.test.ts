import { IncomingMessage } from "node:http";
import { badRequestDefaultError } from "@rexeus/typeweaver-core";
import { TestAssertionError } from "test-utils";
import { afterEach, describe, expect, test, vi } from "vitest";
import { nodeAdapter } from "../../src/lib/NodeAdapter.js";
import { TypeweaverApp } from "../../src/lib/TypeweaverApp.js";
import {
  awaitResponse,
  createControlledIncomingMessage,
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

describe("Node raw Host validation and request targets", () => {
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
});

describe("Node invalid-target request cleanup", () => {
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
});

describe("Node invalid-host body limit cleanup", () => {
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
});
