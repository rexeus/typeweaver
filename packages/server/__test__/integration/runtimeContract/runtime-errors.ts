import { payloadTooLargeDefaultError } from "@rexeus/typeweaver-core";
import { expect, test } from "vitest";
import {
  expectAllow,
  expectJsonResponse,
  jsonTodoBodyWithByteLength,
  runtimeBaseUrl,
  ONE_BYTE_OVER_RUNTIME_MAX_BODY_SIZE_BYTES,
  titleForJsonTodoBodyWithByteLength,
  JSON_CONTENT_TYPE,
} from "./fixtures.js";
import type { ErrorBody, RuntimeEnvironment } from "./fixtures.js";

export function registerRuntimeErrorTests(
  environment: RuntimeEnvironment
): void {
  test("returns NOT_FOUND for unknown runtime paths", async () => {
    const baseUrl = runtimeBaseUrl(environment);
    const { body } = await expectJsonResponse<ErrorBody>(
      fetch(`${baseUrl}/nonexistent`),
      404
    );

    expect(body.code).toBe("NOT_FOUND");
  });

  test("returns METHOD_NOT_ALLOWED with allowed runtime methods", async () => {
    const baseUrl = runtimeBaseUrl(environment);
    const { response, body } = await expectJsonResponse<ErrorBody>(
      fetch(`${baseUrl}/todos`, { method: "DELETE" }),
      405
    );

    expectAllow(response, ["GET", "HEAD", "POST"]);
    expect(body.code).toBe("METHOD_NOT_ALLOWED");
  });

  test("returns the todo OPTIONS allow list in production order", async () => {
    const baseUrl = runtimeBaseUrl(environment);
    const response = await fetch(`${baseUrl}/todos/abc-123`, {
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
    const baseUrl = runtimeBaseUrl(environment);
    const { body } = await expectJsonResponse<ErrorBody>(
      fetch(`${baseUrl}/todos`, {
        method: "POST",
        headers: { "Content-Type": JSON_CONTENT_TYPE },
        body: "{invalid json",
      }),
      400
    );

    expect(body.code).toBe("BAD_REQUEST");
  });

  test("rejects runtime JSON bodies one byte over the size limit", async () => {
    const baseUrl = runtimeBaseUrl(environment);
    const title = titleForJsonTodoBodyWithByteLength(
      ONE_BYTE_OVER_RUNTIME_MAX_BODY_SIZE_BYTES
    );

    const { body } = await expectJsonResponse<ErrorBody>(
      fetch(`${baseUrl}/todos`, {
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
}
