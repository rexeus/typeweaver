import type {
  HttpMethod,
  IRequestValidator,
  IResponseValidator,
  ITypedHttpResponse,
  IValidatedHttpRequest,
} from "@rexeus/typeweaver-core";
import { internalServerErrorDefaultError } from "@rexeus/typeweaver-core";
import { createCreateTodoSuccessResponseBody } from "test-utils";
import { expect } from "vitest";
import { StateMap } from "../src/lib/StateMap.js";
import type { ServerContext } from "../src/lib/ServerContext.js";

export const BASE_URL = "http://localhost";

export const noopValidator: IRequestValidator = {
  validate: request => request as IValidatedHttpRequest,
  safeValidate: request => ({
    isValid: true,
    data: request as IValidatedHttpRequest,
  }),
};

export const noopResponseValidator: IResponseValidator = {
  validate: response => response,
  safeValidate: response => ({ isValid: true, data: response }),
};

export function isUnknownRecord(
  value: unknown
): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function createServerContext(
  overrides: Partial<{
    method: HttpMethod;
    path: string;
    header: Record<string, string | string[] | undefined>;
    query: Record<string, string | string[] | undefined>;
  }> = {}
): ServerContext {
  return {
    request: {
      method: (overrides.method ?? "GET") as HttpMethod,
      path: overrides.path ?? "/test",
      ...(overrides.header ? { header: overrides.header } : {}),
      ...(overrides.query ? { query: overrides.query } : {}),
    },
    signal: new AbortController().signal,
    state: new StateMap(),
    route: undefined,
  };
}

export function get(path: string): Request {
  return new Request(BASE_URL + path);
}

export function post(path: string, body?: unknown): Request {
  return new Request(BASE_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export function put(path: string, body?: unknown): Request {
  return new Request(BASE_URL + path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export function patch(path: string, body?: unknown): Request {
  return new Request(BASE_URL + path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export function del(path: string): Request {
  return new Request(BASE_URL + path, { method: "DELETE" });
}

export function head(path: string): Request {
  return new Request(BASE_URL + path, { method: "HEAD" });
}

export function postRaw(
  path: string,
  body: string,
  contentType: string
): Request {
  return new Request(BASE_URL + path, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(Buffer.byteLength(body)),
    },
    body,
  });
}

export function request(method: string, path: string): Request {
  return new Request(BASE_URL + path, { method });
}

/**
 * Converts an `IHttpRequest` to a native Fetch `Request`.
 * Useful for integration tests that build typed request data
 * and need to pass it through `app.fetch()`.
 */
export function buildFetchRequest(
  url: string,
  requestData: IValidatedHttpRequest
): Request {
  const body =
    typeof requestData.body === "string"
      ? requestData.body
      : requestData.body
        ? JSON.stringify(requestData.body)
        : undefined;

  const headers = new Headers();
  for (const [key, value] of Object.entries(requestData.header ?? {})) {
    if (Array.isArray(value)) {
      for (const v of value) {
        headers.append(key, String(v));
      }
    } else {
      headers.set(key, String(value));
    }
  }

  return new Request(url, {
    method: requestData.method,
    headers,
    ...(body === undefined ? {} : { body }),
  });
}

// The calling test asserts the parsed JSON shape field by field. Returning the
// validated JSON object keeps the test boundary type-safe: callers read
// `unknown` properties instead of an `any` result.
export async function expectJson(
  res: Response,
  status: number
): Promise<Record<string, unknown>> {
  expect(res.status).toBe(status);
  const body: unknown = await res.json();
  if (typeof body !== "object" || body === null) {
    throw new Error("Expected a JSON object response body");
  }
  return body as Record<string, unknown>;
}

/**
 * Builds a typed CreateTodoSuccess response with optional body overrides.
 * Merges overrides with a schema-conformant factory body so all required fields are present.
 */
export function buildCreateTodoSuccess(
  bodyOverrides: Record<string, unknown> = {}
): ITypedHttpResponse {
  const base = createCreateTodoSuccessResponseBody();
  return {
    type: "CreateTodoSuccess" as const,
    statusCode: 201,
    header: { "Content-Type": "application/json" },
    body: { ...base, ...bodyOverrides },
  };
}

export async function expectErrorResponse(
  res: Response,
  status: number,
  code: string
): Promise<Record<string, unknown>> {
  const data = await expectJson(res, status);
  expect(data["code"]).toBe(code);
  if (code === "INTERNAL_SERVER_ERROR") {
    expect(data["message"]).toBe(internalServerErrorDefaultError.message);
  }
  return data;
}
