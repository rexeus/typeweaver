import { TestAssertionError } from "test-utils";
import { expect } from "vitest";
import type { RuntimeServer } from "../helpers.js";

export const JSON_CONTENT_TYPE = "application/json";
export const RUNTIME_MAX_BODY_SIZE_BYTES = 64;
export const ONE_BYTE_OVER_RUNTIME_MAX_BODY_SIZE_BYTES =
  RUNTIME_MAX_BODY_SIZE_BYTES + 1;

export type JsonResponse<TBody> = {
  readonly response: Response;
  readonly body: TBody;
};

export type RuntimeEnvironment = {
  readonly server?: RuntimeServer;
};

export type TodoListBody = {
  readonly results: readonly unknown[];
};

export type TodoBody = {
  readonly id: string;
  readonly title?: string;
  readonly status?: string;
};

export type QueryTodoBody = {
  readonly results: readonly unknown[];
  readonly nextToken?: string;
};

export type ErrorBody = {
  readonly code: string;
  readonly message: string;
};

export type JsonRequestMethod = "PATCH" | "POST" | "PUT";

export function runtimeBaseUrl(environment: RuntimeEnvironment): string {
  if (!environment.server) {
    throw new TestAssertionError("Runtime server has not started");
  }
  return environment.server.baseUrl;
}

export function titleForJsonTodoBodyWithByteLength(
  targetBytes: number
): string {
  const emptyTitleBodyBytes = byteLength(JSON.stringify({ title: "" }));
  const titleBytes = targetBytes - emptyTitleBodyBytes;

  if (titleBytes < 0) {
    throw new TestAssertionError(
      `Cannot build a todo JSON body with title in ${targetBytes} bytes`
    );
  }

  return "x".repeat(titleBytes);
}

export function jsonTodoBodyWithByteLength(
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

export function postJson(
  url: string,
  body: Record<string, unknown>
): Promise<Response> {
  return sendJsonRequest(url, body, "POST");
}

export function putJson(
  url: string,
  body: Record<string, unknown>
): Promise<Response> {
  return sendJsonRequest(url, body, "PUT");
}

export function patchJson(
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

export async function expectJsonResponse<TBody>(
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

export async function expectNoBody(
  response: Response,
  expectedStatus: number
): Promise<void> {
  expect(response.status).toBe(expectedStatus);
  expect(await response.text()).toBe("");
}

export function expectAllow(
  response: Response,
  allowedMethods: readonly string[]
): void {
  expect(response.headers.get("allow")).toBe(allowedMethods.join(", "));
}
