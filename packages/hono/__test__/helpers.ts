import { internalServerErrorDefaultError } from "@rexeus/typeweaver-core";
import type { IHttpRequest, ITypedHttpResponse } from "@rexeus/typeweaver-core";
import { createCreateTodoSuccessResponseBody } from "test-utils";
import { expect } from "vitest";

/**
 * Converts an IHttpRequest to fetch-compatible RequestInit for Hono's `app.request()`.
 */
export function prepareRequestData(requestData: IHttpRequest): RequestInit {
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
  return { method: requestData.method, headers, body };
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
  response: Response,
  status: number,
  code: string
): Promise<Record<string, unknown>> {
  expect(response.status).toBe(status);

  const data = (await response.json()) as Record<string, unknown>;
  expect(data.code).toBe(code);

  if (code === "INTERNAL_SERVER_ERROR") {
    expect(data.message).toBe(internalServerErrorDefaultError.message);
  }

  return data;
}
