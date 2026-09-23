import { expect, test } from "vitest";
import {
  expectJsonResponse,
  jsonTodoBodyWithByteLength,
  patchJson,
  postJson,
  putJson,
  runtimeBaseUrl,
  RUNTIME_MAX_BODY_SIZE_BYTES,
  titleForJsonTodoBodyWithByteLength,
} from "./fixtures.js";
import type { RuntimeEnvironment, TodoBody, TodoListBody } from "./fixtures.js";

export function registerGeneratedRequestTests(
  environment: RuntimeEnvironment
): void {
  test("serves the todo list as JSON", async () => {
    const baseUrl = runtimeBaseUrl(environment);
    const { body } = await expectJsonResponse<TodoListBody>(
      fetch(`${baseUrl}/todos`),
      200
    );

    expect(body.results).toEqual(expect.any(Array));
  });

  test("passes JSON request bodies through generated handlers", async () => {
    const baseUrl = runtimeBaseUrl(environment);
    const { body } = await expectJsonResponse<TodoBody>(
      postJson(`${baseUrl}/todos`, { title: "integration-test" }),
      201
    );

    expect(body.title).toBe("integration-test");
    expect(body.status).toBe("TODO");
  });

  test("accepts runtime JSON bodies exactly at the size limit", async () => {
    const baseUrl = runtimeBaseUrl(environment);
    const title = titleForJsonTodoBodyWithByteLength(
      RUNTIME_MAX_BODY_SIZE_BYTES
    );

    const { body } = await expectJsonResponse<TodoBody>(
      fetch(`${baseUrl}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonTodoBodyWithByteLength(title, RUNTIME_MAX_BODY_SIZE_BYTES),
      }),
      201
    );

    expect(body.title).toBe(title);
    expect(body.status).toBe("TODO");
  });

  test("passes path parameters through generated handlers", async () => {
    const baseUrl = runtimeBaseUrl(environment);
    const { body } = await expectJsonResponse<TodoBody>(
      fetch(`${baseUrl}/todos/abc-123`),
      200
    );

    expect(body.id).toBe("abc-123");
  });

  test("passes path parameters and JSON bodies through generated handlers", async () => {
    const baseUrl = runtimeBaseUrl(environment);
    const { body } = await expectJsonResponse<TodoBody>(
      putJson(`${baseUrl}/todos/abc-123/status`, { value: "DONE" }),
      200
    );

    expect(body).toMatchObject({ id: "abc-123", status: "DONE" });
  });

  test("passes PATCH JSON bodies and path parameters through generated handlers", async () => {
    const baseUrl = runtimeBaseUrl(environment);
    const { body } = await expectJsonResponse<TodoBody>(
      patchJson(`${baseUrl}/todos/abc-123`, {
        title: "patched-runtime-title",
      }),
      200
    );

    expect(body).toMatchObject({
      id: "abc-123",
      title: "patched-runtime-title",
    });
  });
}
