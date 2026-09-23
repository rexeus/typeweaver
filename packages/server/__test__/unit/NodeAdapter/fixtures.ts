import { IncomingMessage } from "node:http";
import { TestAssertionError } from "test-utils";
import { vi } from "vitest";
import { createNodeBodyLimitPolicy } from "../../../src/lib/BodyLimitPolicy.js";
import { nodeAdapter } from "../../../src/lib/NodeAdapter.js";
import { TypeweaverApp } from "../../../src/lib/TypeweaverApp.js";
import { setTypeweaverAppRuntimeContext } from "../../../src/lib/TypeweaverInternals.js";
import {
  awaitResponse,
  createMockIncomingMessage,
  createMockServerResponse,
} from "../../node-helpers.js";
import type {
  NodeRequestHeaders,
  NodeRequestWireMetadata,
} from "../../node-helpers.js";

export type FakeApp = TypeweaverApp<Record<string, unknown>> & {
  readonly receivedRequests: readonly Request[];
};

export function fakeAppReturning(response: Response): FakeApp {
  const receivedRequests: Request[] = [];
  return {
    receivedRequests,
    fetch: async (request: Request) => {
      receivedRequests.push(request);
      return response;
    },
  } as unknown as FakeApp;
}

export function waitForRequestStreamToResume(
  req: IncomingMessage
): Promise<void> {
  return new Promise<void>(resolve => {
    const originalResume = req.resume.bind(req);
    vi.spyOn(req, "resume").mockImplementation(() => {
      resolve();
      return originalResume();
    });
  });
}

export function captureDrainedRequestBody(
  req: IncomingMessage
): Promise<string> {
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

export type InvokeNodeAdapterOptions = {
  readonly app?: Parameters<typeof nodeAdapter>[0];
  readonly response?: Response;
  readonly method: string;
  readonly url: string | undefined;
  readonly headers?: NodeRequestHeaders;
  readonly body?: string | Buffer;
  readonly wireMetadata?: NodeRequestWireMetadata;
  readonly adapterOptions?: Parameters<typeof nodeAdapter>[1];
};

export async function invokeNodeAdapter(options: InvokeNodeAdapterOptions) {
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

export function expectRequest(request: Request | undefined): Request {
  if (request === undefined) {
    throw new TestAssertionError("Expected app.fetch to receive a Request");
  }

  return request;
}

export function fakeAppRejecting(error: unknown): FakeApp {
  const receivedRequests: Request[] = [];
  return {
    receivedRequests,
    fetch: async (request: Request) => {
      receivedRequests.push(request);
      throw error;
    },
  } as unknown as FakeApp;
}

export function fakeAppWithErrorReporter(
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
