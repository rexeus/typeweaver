import { resolve } from "node:path";
import getPort from "get-port";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  fetchJson,
  isRuntimeAvailable,
  RUNTIMES_DIR,
  spawnRuntimeServer,
} from "./helpers.js";
import type { RuntimeServer } from "./helpers.js";

describe.skipIf(!isRuntimeAvailable("bun"))("Bun runtime server", () => {
  let server: RuntimeServer;

  beforeAll(async () => {
    const port = await getPort();
    server = await spawnRuntimeServer(
      {
        name: "Bun",
        command: "bun",
        args: (script, p) => ["run", script, String(p)],
        script: resolve(RUNTIMES_DIR, "serve-bun.ts"),
        available: true,
      },
      port
    );
  });

  afterAll(() => {
    server?.kill();
  });

  test("GET /todos returns 200 with JSON body", async () => {
    const { status, body } = await fetchJson(`${server.baseUrl}/todos`);
    expect(status).toBe(200);
    expect(body).toBeDefined();
  });

  test("POST /todos returns 201 and echoes the request body", async () => {
    const { status, body } = await fetchJson(`${server.baseUrl}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "integration-test" }),
    });
    expect(status).toBe(201);
    expect(body.title).toBe("integration-test");
  });

  test("GET /todos/:todoId returns 200 with the path parameter", async () => {
    const { status, body } = await fetchJson(`${server.baseUrl}/todos/abc-123`);
    expect(status).toBe(200);
    expect(body.id).toBe("abc-123");
  });

  test("DELETE /todos/:todoId returns 204 with empty body", async () => {
    const res = await fetch(`${server.baseUrl}/todos/abc-123`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  test("HEAD /todos/:todoId returns 200 with empty body and headers", async () => {
    const res = await fetch(`${server.baseUrl}/todos/abc-123`, {
      method: "HEAD",
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
    expect(res.headers.get("content-type")).toBeTruthy();
  });

  test("GET /nonexistent returns 404 with NOT_FOUND code", async () => {
    const { status, body } = await fetchJson(`${server.baseUrl}/nonexistent`);
    expect(status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
  });

  test("DELETE /todos returns 405 with Allow header", async () => {
    const { status, body, headers } = await fetchJson(
      `${server.baseUrl}/todos`,
      { method: "DELETE" }
    );
    expect(status).toBe(405);
    expect(headers.get("allow")).toBeTruthy();
    expect(body.code).toBe("METHOD_NOT_ALLOWED");
  });

  test("POST /todos with malformed JSON returns 400 with BAD_REQUEST code", async () => {
    const { status, body } = await fetchJson(`${server.baseUrl}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid json",
    });
    expect(status).toBe(400);
    expect(body.code).toBe("BAD_REQUEST");
  });
});
