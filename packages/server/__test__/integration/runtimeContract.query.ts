import { expect, test } from "vitest";
import {
  expectJsonResponse,
  expectNoBody,
  postJson,
  runtimeBaseUrl,
  JSON_CONTENT_TYPE,
} from "./runtimeContract.helpers.js";
import type {
  QueryTodoBody,
  RuntimeEnvironment,
} from "./runtimeContract.helpers.js";

export function registerQueryAndEmptyResponseTests(
  environment: RuntimeEnvironment
): void {
  test("passes nextToken query parameters through generated handlers", async () => {
    const baseUrl = runtimeBaseUrl(environment);
    const { body } = await expectJsonResponse<QueryTodoBody>(
      postJson(`${baseUrl}/todos/query?nextToken=runtime-query-token`, {}),
      200
    );

    expect(body.nextToken).toBe("runtime-query-token");
  });

  test("returns results when optional query parameters are omitted", async () => {
    const baseUrl = runtimeBaseUrl(environment);
    const { body } = await expectJsonResponse<QueryTodoBody>(
      postJson(`${baseUrl}/todos/query`, {}),
      200
    );

    expect(body.results).toEqual(expect.any(Array));
  });

  test("decodes encoded runtime query values before handlers receive them", async () => {
    const baseUrl = runtimeBaseUrl(environment);
    const { body } = await expectJsonResponse<QueryTodoBody>(
      postJson(`${baseUrl}/todos/query?nextToken=runtime%20query%2Btoken`, {}),
      200
    );

    expect(body.nextToken).toBe("runtime query+token");
  });

  test("returns no body for successful empty responses", async () => {
    const baseUrl = runtimeBaseUrl(environment);
    const response = await fetch(`${baseUrl}/todos/abc-123`, {
      method: "DELETE",
    });

    await expectNoBody(response, 204);
  });

  test("returns no body for HEAD requests while preserving headers", async () => {
    const baseUrl = runtimeBaseUrl(environment);
    const response = await fetch(`${baseUrl}/todos/abc-123`, {
      method: "HEAD",
    });

    await expectNoBody(response, 200);
    expect(response.headers.get("content-type")).toContain(JSON_CONTENT_TYPE);
  });
}
