import type {
  IRequestValidator,
  IResponseValidator,
  ITypedHttpResponse,
  IValidatedHttpRequest,
} from "@rexeus/typeweaver-core";
import {
  HttpMethod,
  internalServerErrorDefaultError,
} from "@rexeus/typeweaver-core";
import {
  createCreateTodoSuccessResponseBody,
  TestAssertionError,
} from "test-utils";
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

function describeValue(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "an array" : typeof value;
}

/**
 * Fails the test unless `value` is a non-array object, so its properties can be
 * read as `unknown` without asserting a type.
 */
export function expectRecord(
  value: unknown,
  description: string
): asserts value is Record<string, unknown> {
  if (!isUnknownRecord(value)) {
    throw new TestAssertionError(
      `Expected ${description} to be an object, received ${describeValue(value)}`
    );
  }
}

/**
 * Fails the test unless `value` is an array whose items are read as `unknown`.
 */
export function expectArray(
  value: unknown,
  description: string
): asserts value is readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new TestAssertionError(
      `Expected ${description} to be an array, received ${describeValue(value)}`
    );
  }
}

export function parseJsonRecord(text: string): Record<string, unknown> {
  const data: unknown = JSON.parse(text);
  expectRecord(data, "the parsed JSON");
  return data;
}

export async function readJsonRecord(
  response: Response
): Promise<Record<string, unknown>> {
  const data: unknown = await response.json();
  expectRecord(data, "the JSON response body");
  return data;
}

/**
 * Replaces fields of a request body, including with values its schema rejects.
 * The result keeps the generic request shape, whose body is `unknown`, so
 * deliberately invalid values need no type assertion.
 */
export function withBodyFields<TMessage extends { readonly body?: unknown }>(
  message: TMessage,
  fields: Readonly<Record<string, unknown>>
): Omit<TMessage, "body"> & { readonly body: Record<string, unknown> } {
  const body: unknown = message.body;
  expectRecord(body, "the body to override");
  return { ...message, body: { ...body, ...fields } };
}

/**
 * Replaces request header values, including with values the schema rejects.
 */
export function withHeaderFields(
  request: IValidatedHttpRequest,
  fields: Readonly<Record<string, string>>
): IValidatedHttpRequest {
  return { ...request, header: { ...request.header, ...fields } };
}

/**
 * Calls `fn` as an untyped JavaScript caller does: the arguments reach the
 * runtime unchecked by the parameter types. Tests use it for values that a
 * signature forbids but the implementation still has to handle.
 */
export function callUntyped(
  fn: (...args: never[]) => unknown,
  ...args: readonly unknown[]
): unknown {
  const result: unknown = Reflect.apply(fn, undefined, args);
  return result;
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
      method: overrides.method ?? HttpMethod.GET,
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
  return await readJsonRecord(res);
}

export async function expectJsonArray(
  res: Response,
  status: number
): Promise<readonly unknown[]> {
  expect(res.status).toBe(status);
  const data: unknown = await res.json();
  expectArray(data, "the JSON response body");
  return data;
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
