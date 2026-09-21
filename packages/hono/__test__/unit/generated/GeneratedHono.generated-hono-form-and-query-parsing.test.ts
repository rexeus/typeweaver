import type { ITypedHttpResponse } from "@rexeus/typeweaver-core";
import {
  createCreateTodoRequest,
  createCreateTodoSuccessResponse,
  createQueryTodoSuccessResponse,
  createTestHono,
  TestAssertionError,
  TodoHono,
} from "test-utils";
import { HonoBodyParseError } from "test-utils/src/test-project/output/lib/hono/index.js";
import { describe, expect, test } from "vitest";
import { prepareRequestData } from "../../helpers.js";
import type { HonoTodoApiHandler } from "test-utils";

type CreateTodoHonoOptions = Omit<
  ConstructorParameters<typeof TodoHono<true>>[0],
  "requestHandlers"
>;

type UnvalidatedTodoHonoOptions = Omit<
  ConstructorParameters<typeof TodoHono<false>>[0],
  "requestHandlers" | "validateRequests" | "validateResponses"
>;

function createRequestHandlersProxy<TValidateRequests extends boolean>(
  handlers: Partial<HonoTodoApiHandler<TValidateRequests>>
): HonoTodoApiHandler<TValidateRequests> {
  return new Proxy(handlers as HonoTodoApiHandler<TValidateRequests>, {
    get: (target, prop) => {
      if (prop in target)
        return target[prop as keyof HonoTodoApiHandler<TValidateRequests>];
      return async () => {
        throw new TestAssertionError(
          `Missing Hono test handler: ${String(prop)}`
        );
      };
    },
  });
}

function createTodoHonoWithHandlers(
  handlers: Partial<HonoTodoApiHandler<true>>,
  options: CreateTodoHonoOptions = {}
): TodoHono<true> {
  return new TodoHono<true>({
    ...options,
    requestHandlers: createRequestHandlersProxy<true>(handlers),
    validateResponses: options.validateResponses ?? false,
  });
}

function createUnvalidatedTodoHonoWithHandlers(
  handlers: Partial<HonoTodoApiHandler<false>>,
  options: UnvalidatedTodoHonoOptions = {}
): TodoHono<false> {
  return new TodoHono<false>({
    ...options,
    validateRequests: false,
    validateResponses: false,
    requestHandlers: createRequestHandlersProxy<false>(handlers),
  });
}

function createCreateTodoRouteReturning(
  response: ITypedHttpResponse,
  options?: CreateTodoHonoOptions
): TodoHono<true> {
  type CreateTodoRouteResponse = Awaited<
    ReturnType<HonoTodoApiHandler["handleCreateTodoRequest"]>
  >;

  return createTodoHonoWithHandlers(
    {
      handleCreateTodoRequest: async () => response as CreateTodoRouteResponse,
    },
    options ?? {}
  );
}

async function requestCreateTodoWithMalformedJson(
  app: Pick<ReturnType<typeof createTestHono>, "request">,
  initOverrides?: RequestInit
): Promise<Response> {
  const headers = new Headers(initOverrides?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return await app.request("http://localhost/todos", {
    ...initOverrides,
    method: initOverrides?.method ?? "POST",
    headers,
    body: initOverrides?.body ?? "{",
  });
}

describe("Generated Hono form and query parsing", () => {
  test("parses repeated form-url-encoded fields into safe records when validation is disabled", async () => {
    let handlerBody: Record<string, unknown> | undefined;
    const app = createUnvalidatedTodoHonoWithHandlers({
      handleCreateTodoRequest: async request => {
        handlerBody = request.body as Record<string, unknown>;
        return createCreateTodoSuccessResponse({
          body: {
            title: handlerBody["title"] as string,
            priority: handlerBody["priority"] as "HIGH",
          },
        });
      },
    });

    const response = await app.request("http://localhost/todos", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "title=first&title=second&priority=HIGH",
    });

    expect(response.status).toBe(201);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["title"]).toEqual(["first", "second"]);
    expect(data["priority"]).toBe("HIGH");
    expect(
      Object.getPrototypeOf(handlerBody as Record<string, unknown>)
    ).toBeNull();
  });

  test("preserves repeated empty query parameter values when validation is disabled", async () => {
    let handlerQuery: Record<string, unknown> | undefined;
    const app = createUnvalidatedTodoHonoWithHandlers({
      handleQueryTodoRequest: async request => {
        handlerQuery = request.query as Record<string, unknown>;
        return createQueryTodoSuccessResponse({
          body: {
            results: [],
            nextToken: handlerQuery["nextToken"] as string,
          },
        });
      },
    });

    const response = await app.request(
      "http://localhost/todos/query?nextToken=&nextToken=second",
      { method: "POST" }
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["nextToken"]).toEqual(["", "second"]);
    expect(handlerQuery?.["nextToken"]).toEqual(["", "second"]);
  });

  test("does not pollute Object.prototype from form-url-encoded __proto__ fields", async () => {
    let handlerBody: Record<string, unknown> | undefined;
    const app = createUnvalidatedTodoHonoWithHandlers({
      handleCreateTodoRequest: async request => {
        handlerBody = request.body as Record<string, unknown>;
        return createCreateTodoSuccessResponse({
          body: { title: String(handlerBody["title"]) },
        });
      },
    });

    const response = await app.request("http://localhost/todos", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "title=safe&__proto__=polluted",
    });

    expect(response.status).toBe(201);
    expect(handlerBody?.["title"]).toBe("safe");
    expect(
      Object.getPrototypeOf(handlerBody as Record<string, unknown>)
    ).toBeNull();
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
  });

  test("does not pollute Object.prototype from query string __proto__ values", async () => {
    let handlerQuery: Record<string, unknown> | undefined;
    const app = createUnvalidatedTodoHonoWithHandlers({
      handleQueryTodoRequest: async request => {
        handlerQuery = request.query as Record<string, unknown>;
        return createQueryTodoSuccessResponse({
          body: { results: [], nextToken: String(handlerQuery["nextToken"]) },
        });
      },
    });

    const response = await app.request(
      "http://localhost/todos/query?nextToken=safe&__proto__=polluted",
      { method: "POST" }
    );

    expect(response.status).toBe(200);
    expect(handlerQuery?.["nextToken"]).toBe("safe");
    expect(
      Object.getPrototypeOf(handlerQuery as Record<string, unknown>)
    ).toBeNull();
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
  });
});

describe("Generated Hono runtime exports", () => {
  test("exports HonoBodyParseError from the generated Hono lib barrel without the plain server error name", async () => {
    let capturedError: unknown;
    const app = createTestHono({
      handleBodyParseErrors: error => {
        capturedError = error;
        return {
          statusCode: 422,
          body: { code: "CUSTOM_BODY_PARSE" },
        };
      },
    });
    const honoRuntime =
      await import("test-utils/src/test-project/output/lib/hono/index.js");
    const error = new HonoBodyParseError("Invalid JSON in request body");

    const response = await requestCreateTodoWithMalformedJson(app);

    expect(response.status).toBe(422);
    expect(error).toBeInstanceOf(HonoBodyParseError);
    expect(error.name).toBe("HonoBodyParseError");
    expect(capturedError).toBeInstanceOf(HonoBodyParseError);
    expect("BodyParseError" in honoRuntime).toBe(false);
  });
});

describe("Generated Hono response serialization", () => {
  test("serializes typed responses returned by route handlers as JSON", async () => {
    const requestData = createCreateTodoRequest({
      body: {
        title: "serialize typed response",
        priority: "HIGH",
      },
    });
    const app = createTodoHonoWithHandlers(
      {
        handleCreateTodoRequest: async request =>
          createCreateTodoSuccessResponse({
            body: {
              title: request.body.title,
              priority: request.body.priority,
              status: "TODO",
            },
          }),
      },
      { validateResponses: true }
    );

    const response = await app.request(
      "http://localhost/todos",
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["title"]).toBe("serialize typed response");
    expect(data["priority"]).toBe("HIGH");
    expect(data["status"]).toBe("TODO");
  });

  test("returns string response bodies unchanged", async () => {
    const customStringResponse = "This is a plain text response";
    const app = createCreateTodoRouteReturning({
      type: "CustomStringResponse" as const,
      statusCode: 200,
      header: { "Content-Type": "text/plain" },
      body: customStringResponse,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.request(
      "http://localhost/todos",
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(customStringResponse);
  });

  test("returns ArrayBuffer response bodies with octet-stream headers and preserved bytes", async () => {
    const body = new TextEncoder().encode("binary data").buffer;
    const app = createCreateTodoRouteReturning({
      type: "CustomArrayBufferResponse" as const,
      statusCode: 200,
      header: { "Content-Type": "application/octet-stream" },
      body,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.request(
      "http://localhost/todos",
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/octet-stream"
    );
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      Buffer.from(body)
    );
  });
});
