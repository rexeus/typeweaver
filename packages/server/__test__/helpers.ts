import type {
  HttpMethod,
  IHttpRequest,
  IRequestValidator,
} from "@rexeus/typeweaver-core";
import { expect } from "vitest";
import { StateMap } from "../src/lib/StateMap";
import type { ServerContext } from "../src/lib/ServerContext";

export const BASE_URL = "http://localhost";

export const noopValidator: IRequestValidator = {
  validate: (req: any) => req,
  safeValidate: (req: any) => ({ isValid: true, data: req }),
};

export function createServerContext(
  overrides: Partial<{
    method: HttpMethod;
    path: string;
    header: Record<string, string | string[]>;
    query: Record<string, string | string[]>;
  }> = {}
): ServerContext {
  return {
    request: {
      method: (overrides.method ?? "GET") as HttpMethod,
      path: overrides.path ?? "/test",
      ...(overrides.header ? { header: overrides.header } : {}),
      ...(overrides.query ? { query: overrides.query } : {}),
    },
    state: new StateMap(),
  };
}

export function get(path: string): Request {
  return new Request(BASE_URL + path);
}

export function post(path: string, body?: unknown): Request {
  return new Request(BASE_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function put(path: string, body?: unknown): Request {
  return new Request(BASE_URL + path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function patch(path: string, body?: unknown): Request {
  return new Request(BASE_URL + path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
  requestData: IHttpRequest
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
        headers.append(key, v);
      }
    } else {
      headers.set(key, value);
    }
  }

  return new Request(url, {
    method: requestData.method,
    headers,
    body,
  });
}

export async function expectJson(res: Response, status: number): Promise<any> {
  expect(res.status).toBe(status);
  return res.json();
}

export async function expectErrorResponse(
  res: Response,
  status: number,
  code: string
): Promise<any> {
  const data = await expectJson(res, status);
  expect(data.code).toBe(code);
  return data;
}
