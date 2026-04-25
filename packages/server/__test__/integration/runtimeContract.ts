import { payloadTooLargeDefaultError } from "@rexeus/typeweaver-core";
import getPort from "get-port";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  fetchJson,
  isRuntimeAvailable,
  spawnRuntimeServer,
} from "./helpers.js";
import type { RuntimeConfig, RuntimeServer } from "./helpers.js";

const OVERSIZED_BODY = "x".repeat(128);

type RuntimeContractSuiteOptions = {
  readonly title: string;
  readonly runtime: RuntimeConfig;
  readonly skipIfUnavailable?: boolean;
};

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
      const { status, body } = await fetchJson(
        `${server.baseUrl}/todos/abc-123`
      );
      expect(status).toBe(200);
      expect(body.id).toBe("abc-123");
    });

    test("DELETE /todos/:todoId returns 204 with empty body", async () => {
      const response = await fetch(`${server.baseUrl}/todos/abc-123`, {
        method: "DELETE",
      });
      expect(response.status).toBe(204);
      expect(await response.text()).toBe("");
    });

    test("HEAD /todos/:todoId returns 200 with empty body and headers", async () => {
      const response = await fetch(`${server.baseUrl}/todos/abc-123`, {
        method: "HEAD",
      });
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("");
      expect(response.headers.get("content-type")).toBeTruthy();
    });

    test("GET /nonexistent returns 404 with NOT_FOUND code", async () => {
      const { status, body } = await fetchJson(`${server.baseUrl}/nonexistent`);
      expect(status).toBe(404);
      expect(body.code).toBe("NOT_FOUND");
    });

    test("DELETE /todos returns 405 with Allow header", async () => {
      const { status, body, headers } = await fetchJson(
        `${server.baseUrl}/todos`,
        {
          method: "DELETE",
        }
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

    test("POST /todos with oversized body returns 413 with PAYLOAD_TOO_LARGE code", async () => {
      const { status, body } = await fetchJson(`${server.baseUrl}/todos`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: OVERSIZED_BODY,
      });
      expect(status).toBe(413);
      expect(body.code).toBe("PAYLOAD_TOO_LARGE");
      expect(body.message).toBe(payloadTooLargeDefaultError.message);
    });
  });
}
