import {
  createCreateTodoRequest,
  createCreateTodoSuccessResponse,
} from "test-utils";
import { describe, expect, test } from "vitest";
import { prepareRequestData } from "../../../helpers.js";
import {
  createCreateTodoRouteReturning,
  createTodoHonoWithHandlers,
} from "./fixtures.js";

function getHeaderValues(headers: Headers, name: string): string[] {
  const setCookieHeaders = (
    headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie?.();

  if (
    name.toLowerCase() === "set-cookie" &&
    setCookieHeaders &&
    setCookieHeaders.length > 0
  ) {
    return setCookieHeaders;
  }

  return headers.get(name)?.split(", ") ?? [];
}

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

describe("Generated Hono Blob response serialization", () => {
  test("returns Blob response bodies with their configured content type", async () => {
    const blob = new Blob(["binary data"], {
      type: "application/octet-stream",
    });
    const app = createCreateTodoRouteReturning({
      type: "CustomBlobResponse" as const,
      statusCode: 200,
      header: { "Content-Type": "application/octet-stream" },
      body: blob,
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
    const responseBlob = await response.blob();
    expect(responseBlob.size).toBe(blob.size);
  });

  test("infers Blob response Content-Type when no response header is supplied", async () => {
    const blob = new Blob(["data"], {
      type: "application/custom-binary",
    });
    const app = createCreateTodoRouteReturning({
      type: "CustomBlobResponse" as const,
      statusCode: 200,
      header: undefined,
      body: blob,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.request(
      "http://localhost/todos",
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/custom-binary"
    );
    expect(await response.text()).toBe("data");
  });

  test("preserves custom single-value response headers", async () => {
    const app = createCreateTodoRouteReturning({
      type: "CreateTodoSuccess" as const,
      statusCode: 201,
      header: {
        "Content-Type": "application/json",
        "X-Test-Header": "single",
      },
      body: { ok: true },
    });
    const requestData = createCreateTodoRequest();

    const response = await app.request(
      "http://localhost/todos",
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("X-Test-Header")).toBe("single");
  });
});

describe("Generated Hono repeated response headers", () => {
  test("joins array-valued response headers into comma-separated Fetch headers", async () => {
    const app = createCreateTodoRouteReturning({
      type: "CreateTodoSuccess" as const,
      statusCode: 201,
      header: {
        "Content-Type": "application/json",
        "X-Multi-Value": ["first", "second"],
      },
      body: { ok: true },
    });
    const requestData = createCreateTodoRequest();

    const response = await app.request(
      "http://localhost/todos",
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("X-Multi-Value")).toBe("first, second");
  });

  test("exposes repeated Set-Cookie response headers when response validation is disabled", async () => {
    const app = createCreateTodoRouteReturning({
      type: "CreateTodoSuccess" as const,
      statusCode: 201,
      header: {
        "Content-Type": "application/json",
        "Set-Cookie": ["a=1", "b=2"],
      },
      body: { ok: true },
    });
    const requestData = createCreateTodoRequest();

    const response = await app.request(
      "http://localhost/todos",
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(201);
    expect(getHeaderValues(response.headers, "Set-Cookie")).toEqual([
      "a=1",
      "b=2",
    ]);
  });
});
