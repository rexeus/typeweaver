import { payloadTooLargeDefaultError } from "@rexeus/typeweaver-core";
import getPort from "get-port";
import { TestAssertionError } from "test-utils";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { isRuntimeAvailable, spawnRuntimeServer } from "./helpers.js";
import type { RuntimeConfig, RuntimeServer } from "./helpers.js";

const JSON_CONTENT_TYPE = "application/json";
const RUNTIME_MAX_BODY_SIZE_BYTES = 64;
const ONE_BYTE_OVER_RUNTIME_MAX_BODY_SIZE_BYTES =
  RUNTIME_MAX_BODY_SIZE_BYTES + 1;

type RuntimeContractSuiteOptions = {
  readonly title: string;
  readonly runtime: RuntimeConfig;
  readonly skipIfUnavailable?: boolean;
};

type JsonResponse<TBody> = {
  readonly response: Response;
  readonly body: TBody;
};

type TodoListBody = {
  readonly results: readonly unknown[];
};

type TodoBody = {
  readonly id: string;
  readonly title?: string;
  readonly status?: string;
};

type QueryTodoBody = {
  readonly results: readonly unknown[];
  readonly nextToken?: string;
};

type ErrorBody = {
  readonly code: string;
  readonly message: string;
};

type JsonRequestMethod = "PATCH" | "POST" | "PUT";

export function describeRuntimeContractSuite(
  options: RuntimeContractSuiteOptions
): void {
  const describeRuntime = options.skipIfUnavailable
    ? describe.skipIf(!isRuntimeAvailable(options.runtime.command))
    : describe;

  describeRuntime(options.title, () => {
    let server: RuntimeServer;

    beforeAll(async () => {
      const port = await getPort();
      server = await spawnRuntimeServer(options.runtime, port);
    });

    afterAll(async () => {
      await server?.kill();
    });

    test("serves the todo list as JSON", async () => {
      const { body } = await expectJsonResponse<TodoListBody>(
        fetch(`${server.baseUrl}/todos`),
        200
      );

      expect(body.results).toEqual(expect.any(Array));
    });

    test("passes JSON request bodies through generated handlers", async () => {
      const { body } = await expectJsonResponse<TodoBody>(
        postJson(`${server.baseUrl}/todos`, { title: "integration-test" }),
        201
      );

      expect(body.title).toBe("integration-test");
      expect(body.status).toBe("TODO");
    });

    test("accepts runtime JSON bodies exactly at the size limit", async () => {
      const title = titleForJsonTodoBodyWithByteLength(
        RUNTIME_MAX_BODY_SIZE_BYTES
      );

      const { body } = await expectJsonResponse<TodoBody>(
        fetch(`${server.baseUrl}/todos`, {
          method: "POST",
          headers: { "Content-Type": JSON_CONTENT_TYPE },
          body: jsonTodoBodyWithByteLength(title, RUNTIME_MAX_BODY_SIZE_BYTES),
        }),
        201
      );

      expect(body.title).toBe(title);
      expect(body.status).toBe("TODO");
    });

    test("passes path parameters through generated handlers", async () => {
      const { body } = await expectJsonResponse<TodoBody>(
        fetch(`${server.baseUrl}/todos/abc-123`),
        200
      );

      expect(body.id).toBe("abc-123");
    });

    test("passes path parameters and JSON bodies through generated handlers", async () => {
      const { body } = await expectJsonResponse<TodoBody>(
        putJson(`${server.baseUrl}/todos/abc-123/status`, { value: "DONE" }),
        200
      );

      expect(body).toMatchObject({ id: "abc-123", status: "DONE" });
    });

    test("passes PATCH JSON bodies and path parameters through generated handlers", async () => {
      const { body } = await expectJsonResponse<TodoBody>(
        patchJson(`${server.baseUrl}/todos/abc-123`, {
          title: "patched-runtime-title",
        }),
        200
      );

      expect(body).toMatchObject({
        id: "abc-123",
        title: "patched-runtime-title",
      });
    });

    test("passes nextToken query parameters through generated handlers", async () => {
      const { body } = await expectJsonResponse<QueryTodoBody>(
        postJson(
          `${server.baseUrl}/todos/query?nextToken=runtime-query-token`,
          {}
        ),
        200
      );

      expect(body.nextToken).toBe("runtime-query-token");
    });

    test("returns results when optional query parameters are omitted", async () => {
      const { body } = await expectJsonResponse<QueryTodoBody>(
        postJson(`${server.baseUrl}/todos/query`, {}),
        200
      );

      expect(body.results).toEqual(expect.any(Array));
    });

    test("decodes encoded runtime query values before handlers receive them", async () => {
      const { body } = await expectJsonResponse<QueryTodoBody>(
        postJson(
          `${server.baseUrl}/todos/query?nextToken=runtime%20query%2Btoken`,
          {}
        ),
        200
      );

      expect(body.nextToken).toBe("runtime query+token");
    });

    test("returns no body for successful empty responses", async () => {
      const response = await fetch(`${server.baseUrl}/todos/abc-123`, {
        method: "DELETE",
      });

      await expectNoBody(response, 204);
    });

    test("returns no body for HEAD requests while preserving headers", async () => {
      const response = await fetch(`${server.baseUrl}/todos/abc-123`, {
        method: "HEAD",
      });

      await expectNoBody(response, 200);
      expect(response.headers.get("content-type")).toContain(JSON_CONTENT_TYPE);
    });

    test("returns NOT_FOUND for unknown runtime paths", async () => {
      const { body } = await expectJsonResponse<ErrorBody>(
        fetch(`${server.baseUrl}/nonexistent`),
        404
      );

      expect(body.code).toBe("NOT_FOUND");
    });

    test("returns METHOD_NOT_ALLOWED with allowed runtime methods", async () => {
      const { response, body } = await expectJsonResponse<ErrorBody>(
        fetch(`${server.baseUrl}/todos`, { method: "DELETE" }),
        405
      );

      expectAllow(response, ["GET", "HEAD", "POST"]);
      expect(body.code).toBe("METHOD_NOT_ALLOWED");
    });

    test("returns the todo OPTIONS allow list in production order", async () => {
      const response = await fetch(`${server.baseUrl}/todos/abc-123`, {
        method: "OPTIONS",
      });

      expect(response.status).toBe(200);
      expectAllow(response, [
        "GET",
        "HEAD",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
      ]);
    });

    test("returns BAD_REQUEST for malformed runtime JSON bodies", async () => {
      const { body } = await expectJsonResponse<ErrorBody>(
        fetch(`${server.baseUrl}/todos`, {
          method: "POST",
          headers: { "Content-Type": JSON_CONTENT_TYPE },
          body: "{invalid json",
        }),
        400
      );

      expect(body.code).toBe("BAD_REQUEST");
    });

    test("rejects runtime JSON bodies one byte over the size limit", async () => {
      const title = titleForJsonTodoBodyWithByteLength(
        ONE_BYTE_OVER_RUNTIME_MAX_BODY_SIZE_BYTES
      );

      const { body } = await expectJsonResponse<ErrorBody>(
        fetch(`${server.baseUrl}/todos`, {
          method: "POST",
          headers: { "Content-Type": JSON_CONTENT_TYPE },
          body: jsonTodoBodyWithByteLength(
            title,
            ONE_BYTE_OVER_RUNTIME_MAX_BODY_SIZE_BYTES
          ),
        }),
        413
      );

      expect(body.code).toBe("PAYLOAD_TOO_LARGE");
      expect(body.message).toBe(payloadTooLargeDefaultError.message);
    });
  });
}

function titleForJsonTodoBodyWithByteLength(targetBytes: number): string {
  const emptyTitleBodyBytes = byteLength(JSON.stringify({ title: "" }));
  const titleBytes = targetBytes - emptyTitleBodyBytes;

  if (titleBytes < 0) {
    throw new TestAssertionError(
      `Cannot build a todo JSON body with title in ${targetBytes} bytes`
    );
  }

  return "x".repeat(titleBytes);
}

function jsonTodoBodyWithByteLength(
  title: string,
  expectedBytes: number
): string {
  const body = JSON.stringify({ title });

  expect(byteLength(body)).toBe(expectedBytes);

  return body;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function postJson(
  url: string,
  body: Record<string, unknown>
): Promise<Response> {
  return sendJsonRequest(url, body, "POST");
}

function putJson(
  url: string,
  body: Record<string, unknown>
): Promise<Response> {
  return sendJsonRequest(url, body, "PUT");
}

function patchJson(
  url: string,
  body: Record<string, unknown>
): Promise<Response> {
  return sendJsonRequest(url, body, "PATCH");
}

function sendJsonRequest(
  url: string,
  body: Record<string, unknown>,
  method: JsonRequestMethod
): Promise<Response> {
  return fetch(url, {
    method,
    headers: { "Content-Type": JSON_CONTENT_TYPE },
    body: JSON.stringify(body),
  });
}

async function expectJsonResponse<TBody>(
  responsePromise: Promise<Response>,
  expectedStatus: number
): Promise<JsonResponse<TBody>> {
  const response = await responsePromise;

  expect(response.status).toBe(expectedStatus);
  expect(response.headers.get("content-type")).toContain(JSON_CONTENT_TYPE);

  return {
    response,
    body: (await response.json()) as TBody,
  };
}

async function expectNoBody(
  response: Response,
  expectedStatus: number
): Promise<void> {
  expect(response.status).toBe(expectedStatus);
  expect(await response.text()).toBe("");
}

function expectAllow(
  response: Response,
  allowedMethods: readonly string[]
): void {
  expect(response.headers.get("allow")).toBe(allowedMethods.join(", "));
}
