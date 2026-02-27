import { HttpResponse } from "@rexeus/typeweaver-core";
import {
  createCreateTodoRequest,
  createDeleteTodoRequest,
  createHeadTodoRequest,
  createListTodosRequest,
  createOptionsTodoRequest,
  createTestApp,
  createUpdateTodoRequest,
  createUpdateTodoStatusRequest,
  defineMiddleware,
} from "test-utils";
import { describe, expect, test } from "vitest";
import {
  BASE_URL,
  buildFetchRequest,
  expectErrorResponse,
  expectJson,
} from "../../helpers";
import type { IValidationErrorResponseBody } from "test-utils";

describe("Generated Server Router", () => {
  describe("Operation Registration & Handling", () => {
    test.each([
      {
        name: "GET",
        setup: () => ({
          req: createListTodosRequest(),
          url: `${BASE_URL}/todos?status=TODO`,
        }),
        expectedStatus: 200,
      },
      {
        name: "POST",
        setup: () => ({
          req: createCreateTodoRequest(),
          url: `${BASE_URL}/todos`,
        }),
        expectedStatus: 201,
      },
      {
        name: "PUT",
        setup: () => {
          const req = createUpdateTodoStatusRequest();
          return {
            req,
            url: `${BASE_URL}/todos/${req.param.todoId}/status`,
          };
        },
        expectedStatus: 200,
      },
      {
        name: "DELETE",
        setup: () => {
          const req = createDeleteTodoRequest();
          return { req, url: `${BASE_URL}/todos/${req.param.todoId}` };
        },
        expectedStatus: 204,
      },
      {
        name: "PATCH",
        setup: () => {
          const req = createUpdateTodoRequest();
          return { req, url: `${BASE_URL}/todos/${req.param.todoId}` };
        },
        expectedStatus: 200,
      },
      {
        name: "OPTIONS",
        setup: () => {
          const req = createOptionsTodoRequest();
          return { req, url: `${BASE_URL}/todos/${req.param.todoId}` };
        },
        expectedStatus: 200,
      },
      {
        name: "HEAD (via GET fallback)",
        setup: () => {
          const req = createHeadTodoRequest();
          return { req, url: `${BASE_URL}/todos/${req.param.todoId}` };
        },
        expectedStatus: 200,
      },
    ])(
      "should register and handle $name operations",
      async ({ setup, expectedStatus }) => {
        const app = createTestApp();
        const { req, url } = setup();

        const response = await app.fetch(buildFetchRequest(url, req));

        expect(response.status).toBe(expectedStatus);
      }
    );

    test("should return empty body for HEAD operations", async () => {
      const app = createTestApp();
      const requestData = createHeadTodoRequest();

      const response = await app.fetch(
        buildFetchRequest(
          `${BASE_URL}/todos/${requestData.param.todoId}`,
          requestData
        )
      );

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("");
    });

    test("should include Allow header for OPTIONS operations", async () => {
      const app = createTestApp();
      const requestData = createOptionsTodoRequest();

      const response = await app.fetch(
        buildFetchRequest(
          `${BASE_URL}/todos/${requestData.param.todoId}`,
          requestData
        )
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("Allow")).toBe(
        "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS"
      );
    });

    test("should return 404 for unknown paths", async () => {
      const app = createTestApp();

      const response = await app.fetch(
        new Request(`${BASE_URL}/unknown-path`, { method: "GET" })
      );

      await expectErrorResponse(response, 404, "NOT_FOUND");
    });

    test("should return 405 for wrong method on valid path", async () => {
      const app = createTestApp();

      const response = await app.fetch(
        new Request(`${BASE_URL}/todos`, { method: "PATCH" })
      );

      await expectErrorResponse(response, 405, "METHOD_NOT_ALLOWED");
      expect(response.headers.get("Allow")).toContain("GET");
    });
  });

  describe("Request Validation", () => {
    test.each([
      {
        name: "body",
        createRequest: () =>
          createCreateTodoRequest({
            body: { priority: "INVALID_PRIORITY" as any },
          }),
        url: `${BASE_URL}/todos`,
        issueKey: "body" as const,
      },
      {
        name: "headers",
        createRequest: () =>
          createCreateTodoRequest({
            header: { "Content-Type": "text/plain" as any },
          }),
        url: `${BASE_URL}/todos`,
        issueKey: "header" as const,
      },
      {
        name: "path parameters",
        createRequest: () => createUpdateTodoRequest(),
        url: `${BASE_URL}/todos/invalid-uuid-format`,
        issueKey: "param" as const,
      },
      {
        name: "query parameters",
        createRequest: () => createListTodosRequest(),
        url: `${BASE_URL}/todos?status=INVALID_STATUS`,
        issueKey: "query" as const,
      },
    ])(
      "should reject invalid $name",
      async ({ createRequest, url, issueKey }) => {
        const app = createTestApp();
        const requestData = createRequest();

        const response = await app.fetch(buildFetchRequest(url, requestData));

        const data = (await expectErrorResponse(
          response,
          400,
          "VALIDATION_ERROR"
        )) as IValidationErrorResponseBody;
        expect(data.issues[issueKey]).toHaveLength(1);
      }
    );

    test("should bypass validation when validateRequests is disabled", async () => {
      const app = createTestApp({ validateRequests: false });
      const requestData = createCreateTodoRequest({ body: { title: "" } });

      const response = await app.fetch(
        buildFetchRequest(`${BASE_URL}/todos`, requestData)
      );

      expect(response.status).toBe(201);
    });

    test("should use custom validation error handler when provided", async () => {
      const app = createTestApp({
        handleValidationErrors: () => ({
          statusCode: 400,
          header: { "Content-Type": "application/json" },
          body: { message: "Custom validation error" },
        }),
      });
      const requestData = createCreateTodoRequest({
        body: { priority: "INVALID_PRIORITY" as any },
      });

      const response = await app.fetch(
        buildFetchRequest(`${BASE_URL}/todos`, requestData)
      );

      const data = await expectJson(response, 400);
      expect(data.message).toBe("Custom validation error");
    });
  });

  describe("Response Handling", () => {
    test("should handle JSON response bodies", async () => {
      const app = createTestApp();
      const requestData = createCreateTodoRequest();

      const response = await app.fetch(
        buildFetchRequest(`${BASE_URL}/todos`, requestData)
      );

      expect(response.headers.get("Content-Type")).toBe("application/json");
      const data = await expectJson(response, 201);
      expect(data.id).toEqual(expect.any(String));
      expect(data.title).toBe(requestData.body.title);
    });

    test("should handle string response bodies", async () => {
      const customStringResponse = "This is a plain text response";
      const app = createTestApp({
        throwTodoError: new HttpResponse(
          200,
          { "Content-Type": "text/plain" },
          customStringResponse
        ),
      });
      const requestData = createCreateTodoRequest();

      const response = await app.fetch(
        buildFetchRequest(`${BASE_URL}/todos`, requestData)
      );

      expect(response.status).toBe(200);
      expect(await response.text()).toBe(customStringResponse);
    });

    test("should handle empty response bodies", async () => {
      const app = createTestApp();
      const requestData = createDeleteTodoRequest();

      const response = await app.fetch(
        buildFetchRequest(
          `${BASE_URL}/todos/${requestData.param.todoId}`,
          requestData
        )
      );

      expect(response.status).toBe(204);
      expect(await response.text()).toBe("");
    });

    test("should handle multi-value response headers", async () => {
      const app = createTestApp();
      const requestData = createOptionsTodoRequest();

      const response = await app.fetch(
        buildFetchRequest(
          `${BASE_URL}/todos/${requestData.param.todoId}`,
          requestData
        )
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("Allow")).toBe(
        "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS"
      );
    });
  });

  describe("Error Handling", () => {
    test("should handle HTTP response errors with default handler", async () => {
      const app = createTestApp({
        throwTodoError: new HttpResponse(
          404,
          {},
          { errorCode: "TODO_NOT_FOUND" }
        ),
      });
      const requestData = createCreateTodoRequest();

      const response = await app.fetch(
        buildFetchRequest(`${BASE_URL}/todos`, requestData)
      );

      const data = await expectJson(response, 404);
      expect(data.errorCode).toBe("TODO_NOT_FOUND");
    });

    test("should handle HTTP response errors with custom handler", async () => {
      const app = createTestApp({
        throwTodoError: new HttpResponse(
          404,
          {},
          { errorCode: "TODO_NOT_FOUND" }
        ),
        handleHttpResponseErrors: () => ({
          statusCode: 404,
          body: { customMessage: "Custom error handling" },
        }),
      });
      const requestData = createCreateTodoRequest();

      const response = await app.fetch(
        buildFetchRequest(`${BASE_URL}/todos`, requestData)
      );

      const data = await expectJson(response, 404);
      expect(data.customMessage).toBe("Custom error handling");
    });

    test("should handle validation errors with custom handler", async () => {
      const app = createTestApp({
        handleValidationErrors: () => ({
          statusCode: 404,
          body: { customValidationError: "Custom validation error handling" },
        }),
      });
      const requestData = createCreateTodoRequest({
        body: { priority: "INVALID_PRIORITY" as any },
      });

      const response = await app.fetch(
        buildFetchRequest(`${BASE_URL}/todos`, requestData)
      );

      const data = await expectJson(response, 404);
      expect(data.customValidationError).toBe(
        "Custom validation error handling"
      );
    });

    test("should handle unknown errors with default handler", async () => {
      const app = createTestApp({
        throwTodoError: new Error("Something went wrong"),
      });
      const requestData = createCreateTodoRequest();

      const response = await app.fetch(
        buildFetchRequest(`${BASE_URL}/todos`, requestData)
      );

      await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
    });

    test("should handle unknown errors with custom handler", async () => {
      const app = createTestApp({
        throwTodoError: new Error("Something went wrong"),
        handleUnknownErrors: () => ({
          statusCode: 500,
          body: { customUnknownError: "Custom unknown error handling" },
        }),
      });
      const requestData = createCreateTodoRequest();

      const response = await app.fetch(
        buildFetchRequest(`${BASE_URL}/todos`, requestData)
      );

      const data = await expectJson(response, 500);
      expect(data.customUnknownError).toBe("Custom unknown error handling");
    });

    test("should handle validation error handler failures with unknown handlers", async () => {
      const app = createTestApp({
        handleValidationErrors: () => {
          throw new Error("Validation handler failed");
        },
      });
      const requestData = createCreateTodoRequest({
        body: { priority: "INVALID_PRIORITY" as any },
      });

      const response = await app.fetch(
        buildFetchRequest(`${BASE_URL}/todos`, requestData)
      );

      await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
    });

    test("should handle HTTP response error handler failures with unknown handlers", async () => {
      const app = createTestApp({
        throwTodoError: new HttpResponse(
          404,
          {},
          { code: "TODO_NOT_FOUND", message: "Todo not found" }
        ),
        handleHttpResponseErrors: () => {
          throw new Error("HTTP handler failed");
        },
      });
      const requestData = createCreateTodoRequest();

      const response = await app.fetch(
        buildFetchRequest(`${BASE_URL}/todos`, requestData)
      );

      await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
    });
  });

  describe("Middleware", () => {
    test("should execute global middleware for all requests", async () => {
      const app = createTestApp();
      let middlewareExecuted = false;
      app.use(
        defineMiddleware(async (_ctx, next) => {
          middlewareExecuted = true;
          return next();
        })
      );
      const requestData = createCreateTodoRequest();

      await app.fetch(buildFetchRequest(`${BASE_URL}/todos`, requestData));

      expect(middlewareExecuted).toBe(true);
    });

    test("should execute middleware even for 404 responses", async () => {
      const app = createTestApp();
      let middlewareExecuted = false;
      app.use(
        defineMiddleware(async (_ctx, next) => {
          middlewareExecuted = true;
          return next();
        })
      );

      await app.fetch(
        new Request(`${BASE_URL}/unknown-path`, { method: "GET" })
      );

      expect(middlewareExecuted).toBe(true);
    });

    test("should allow middleware to short-circuit with custom response", async () => {
      const app = createTestApp({
        customResponses: {
          statusCode: 418,
          body: { message: "I'm a teapot" },
        },
      });
      const requestData = createCreateTodoRequest();

      const response = await app.fetch(
        buildFetchRequest(`${BASE_URL}/todos`, requestData)
      );

      const data = await expectJson(response, 418);
      expect(data.message).toBe("I'm a teapot");
    });
  });
});
