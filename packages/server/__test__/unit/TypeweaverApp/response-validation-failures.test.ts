import { TestApplicationError } from "test-utils";
import { describe, expect, test, vi } from "vitest";
import { TypeweaverApp } from "../../../src/lib/TypeweaverApp.js";
import { expectErrorResponse, expectJson, get } from "../../helpers.js";
import {
  createResponseValidatingApp,
  defaultHandlers,
  expectInternalError,
  ResponseValidatingRouter,
} from "./fixtures.js";

describe("TypeweaverApp response validation failures", () => {
  test("returns the original invalid response when response validation handling is disabled", async () => {
    const app = createResponseValidatingApp(
      { handleResponseValidationErrors: false },
      {
        handleGetTodos: async () => ({
          statusCode: 200,
          header: { "x-invalid": "yes" },
          body: { invalid: true },
        }),
      }
    );

    const res = await app.fetch(get("/todos"));

    const data = await expectJson(res, 200);
    expect(data).toEqual({ invalid: true });
    expect(res.headers.get("x-invalid")).toBe("yes");
  });

  test("returns a sanitized 500 when the custom response validation handler throws", async () => {
    const onError = vi.fn();
    const handlerFailure = new TestApplicationError(
      "response validation handler failed"
    );
    const app = createResponseValidatingApp(
      {
        handleResponseValidationErrors: () => {
          throw handlerFailure;
        },
      },
      {
        handleGetTodos: async () => ({
          statusCode: 200,
          body: { secret: "invalid response detail" },
        }),
      },
      { onError }
    );

    const res = await app.fetch(get("/todos"));

    const data = await expectInternalError(res);
    expect(JSON.stringify(data)).not.toContain("invalid response detail");
  });

  test("reports onError when the custom response validation handler throws", async () => {
    const onError = vi.fn();
    const handlerFailure = new TestApplicationError(
      "response validation handler failed"
    );
    const app = createResponseValidatingApp(
      {
        handleResponseValidationErrors: () => {
          throw handlerFailure;
        },
      },
      {
        handleGetTodos: async () => ({
          statusCode: 200,
          body: { invalid: true },
        }),
      },
      { onError }
    );

    await app.fetch(get("/todos"));

    expect(onError).toHaveBeenCalledWith(handlerFailure);
  });

  test("routes a thrown response validator failure through the route unknown handler", async () => {
    const responseValidationFailure = new TestApplicationError(
      "response validation failed"
    );
    const unknownHandler = vi.fn(() => ({
      statusCode: 500,
      body: { code: "CUSTOM_UNKNOWN" },
    }));
    const app = new TypeweaverApp();
    const router = new ResponseValidatingRouter({
      validateRequests: false,
      requestHandlers: defaultHandlers(),
      responseValidator: {
        validate: () => {
          throw responseValidationFailure;
        },
        safeValidate: () => {
          throw responseValidationFailure;
        },
      },
      handleUnknownErrors: unknownHandler,
    });
    app.route(router);

    const res = await app.fetch(get("/todos"));

    await expectErrorResponse(res, 500, "CUSTOM_UNKNOWN");
    expect(unknownHandler).toHaveBeenCalledWith(
      responseValidationFailure,
      expect.objectContaining({
        route: {
          operationId: "listTodos",
          method: "GET",
          path: "/todos",
        },
      })
    );
  });
});
