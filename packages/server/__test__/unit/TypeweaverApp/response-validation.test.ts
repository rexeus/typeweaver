import {
  internalServerErrorDefaultError,
  ResponseValidationError,
} from "@rexeus/typeweaver-core";
import type {
  IHttpResponse,
  IResponseValidator,
} from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { TypeweaverApp } from "../../../src/lib/TypeweaverApp.js";
import { expectJson, get } from "../../helpers.js";
import {
  createResponseValidatingApp,
  CustomResponseValidatingRouter,
  defaultHandlers,
  expectInternalError,
} from "./fixtures.js";
import type { ResponseValidationErrorHandler } from "../../../src/lib/routerTypes.js";

function anInvalidTodosResponse(): IHttpResponse {
  return {
    statusCode: 200,
    header: { "x-invalid": "yes" },
    body: { invalid: true },
  };
}

describe("Response Validation", () => {
  test("returns validated response data when response validation transforms the handler response", async () => {
    const responseValidator: IResponseValidator = {
      validate: response => ({
        ...response,
        header: { "x-response-source": "validator" },
        body: { title: "validated todo" },
      }),
      safeValidate: response => ({
        isValid: true,
        data: {
          ...response,
          header: { "x-response-source": "validator" },
          body: { title: "validated todo" },
        },
      }),
    };
    const app = new TypeweaverApp();
    const router = new CustomResponseValidatingRouter({
      validateRequests: false,
      responseValidator,
      requestHandlers: defaultHandlers({
        handleGetTodos: async () => ({
          statusCode: 200,
          header: { "x-response-source": "handler" },
          body: {
            title: "raw todo",
            sensitive: "handler-only response detail",
          },
        }),
      }),
    });
    app.route(router);

    const res = await app.fetch(get("/todos"));

    const data = await expectJson(res, 200);
    expect(data).toEqual({ title: "validated todo" });
    expect(res.headers.get("x-response-source")).toBe("validator");
  });

  test("returns the handler response unchanged when response validation is disabled", async () => {
    const handlerResponse: IHttpResponse = {
      statusCode: 200,
      header: { "x-response-source": "handler" },
      body: { source: "handler" },
    };
    const responseValidator: IResponseValidator = {
      validate: () => {
        throw new ResponseValidationError(418);
      },
      safeValidate: response => {
        return {
          isValid: true,
          data: {
            ...response,
            statusCode: 202,
            header: { "x-response-source": "validator" },
            body: { source: "validator" },
          },
        };
      },
    };
    const app = new TypeweaverApp();
    const router = new CustomResponseValidatingRouter({
      validateRequests: false,
      validateResponses: false,
      responseValidator,
      requestHandlers: defaultHandlers({
        handleGetTodos: async () => handlerResponse,
      }),
    });
    app.route(router);

    const res = await app.fetch(get("/todos"));

    const data = await expectJson(res, 200);
    expect(data).toEqual({ source: "handler" });
    expect(res.headers.get("x-response-source")).toBe("handler");
  });
});

describe("TypeweaverApp invalid response handling", () => {
  test("returns a sanitized 500 when the default response validation handler handles an invalid response", async () => {
    const app = createResponseValidatingApp(undefined, {
      handleGetTodos: async () => ({
        statusCode: 200,
        body: { leaked: "response validation internals" },
      }),
    });

    const res = await app.fetch(get("/todos"));

    const data = await expectInternalError(res);
    expect(data["message"]).toBe(internalServerErrorDefaultError["message"]);
    expect(JSON.stringify(data)).not.toContain("response validation internals");
  });

  test("returns the custom response validation handler response when a response is invalid", async () => {
    const handler: ResponseValidationErrorHandler = (
      _error,
      _response,
      ctx
    ) => {
      return {
        statusCode: 422,
        body: {
          code: "INVALID_RESPONSE",
          operationId: ctx.route?.operationId,
        },
      };
    };
    const app = createResponseValidatingApp(
      { handleResponseValidationErrors: handler },
      { handleGetTodos: async () => anInvalidTodosResponse() }
    );

    const res = await app.fetch(get("/todos"));

    const data = await expectJson(res, 422);
    expect(data).toEqual({
      code: "INVALID_RESPONSE",
      operationId: "listTodos",
    });
  });

  test("passes the validation error, original response, and route metadata to the custom response validation handler", async () => {
    const invalidResponse = anInvalidTodosResponse();
    let captured:
      | {
          readonly error: ResponseValidationError;
          readonly response: IHttpResponse;
          readonly route: unknown;
        }
      | undefined;
    const handler: ResponseValidationErrorHandler = (error, response, ctx) => {
      captured = { error, response, route: ctx.route };
      return {
        statusCode: 422,
        body: { code: "INVALID_RESPONSE" },
      };
    };
    const app = createResponseValidatingApp(
      { handleResponseValidationErrors: handler },
      { handleGetTodos: async () => invalidResponse }
    );

    await app.fetch(get("/todos"));

    expect(captured?.error).toBeInstanceOf(ResponseValidationError);
    expect(captured?.error.statusCode).toBe(200);
    expect(captured?.response).toEqual(invalidResponse);
    expect(captured?.route).toEqual({
      operationId: "listTodos",
      method: "GET",
      path: "/todos",
    });
  });
});
