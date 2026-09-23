import { HttpStatusCode } from "@rexeus/typeweaver-core";
import type {
  IResponseValidator,
  ITypedHttpResponse,
} from "@rexeus/typeweaver-core";
import { TestApplicationError } from "test-utils";
import { describe, expect, test, vi } from "vitest";
import { TypeweaverApp } from "../../../src/lib/TypeweaverApp.js";
import { expectErrorResponse, expectJson, get, head } from "../../helpers.js";
import {
  CustomResponseValidatingRouter,
  defaultHandlers,
  expectNoBody,
  invalidResponseValidator,
} from "./fixtures.js";
import type { TypeweaverAppOptions } from "../../../src/lib/TypeweaverApp.js";
import type { TypeweaverRouterOptions } from "../../../src/lib/TypeweaverRouter.js";
import type { TestHandlers } from "./fixtures.js";

function aConflictTypedResponse(): ITypedHttpResponse<
  "ConflictError",
  HttpStatusCode.CONFLICT,
  undefined,
  { readonly code: string }
> {
  return {
    type: "ConflictError",
    statusCode: HttpStatusCode.CONFLICT,
    body: { code: "CONFLICT" },
  };
}

function aPassThroughResponseValidator(): IResponseValidator {
  return {
    validate: response => response,
    safeValidate: response => ({ isValid: true, data: response }),
  };
}

function aValidatorThatMarksResponsesAsValidated(): IResponseValidator {
  return {
    validate: response => response,
    safeValidate: response => ({
      isValid: true,
      data: {
        ...response,
        header: { "x-response-source": "validator" },
        body: { source: "validated" },
      },
    }),
  };
}

type TypedResponseValidationAppOptions = {
  readonly typedResponse?: ITypedHttpResponse;
  readonly responseValidator?: IResponseValidator;
  readonly handleHttpResponseErrors?: TypeweaverRouterOptions<TestHandlers>["handleHttpResponseErrors"];
  readonly handleUnknownErrors?: TypeweaverRouterOptions<TestHandlers>["handleUnknownErrors"];
  readonly handleResponseValidationErrors?: TypeweaverRouterOptions<TestHandlers>["handleResponseValidationErrors"];
  readonly onError?: TypeweaverAppOptions["onError"];
};

function createTypedResponseValidationApp({
  typedResponse = aConflictTypedResponse(),
  responseValidator = aPassThroughResponseValidator(),
  handleHttpResponseErrors,
  handleUnknownErrors,
  handleResponseValidationErrors,
  onError,
}: TypedResponseValidationAppOptions = {}): TypeweaverApp {
  const app = new TypeweaverApp(
    onError === undefined ? undefined : { onError }
  );
  const router = new CustomResponseValidatingRouter({
    validateRequests: false,
    responseValidator,
    requestHandlers: defaultHandlers({
      handleGetTodos: async () => {
        throw typedResponse;
      },
    }),
    ...(handleHttpResponseErrors === undefined
      ? {}
      : { handleHttpResponseErrors }),
    ...(handleUnknownErrors === undefined ? {} : { handleUnknownErrors }),
    ...(handleResponseValidationErrors === undefined
      ? {}
      : { handleResponseValidationErrors }),
  });

  app.route(router);
  return app;
}

describe("TypeweaverApp typed response validation", () => {
  test("calls the custom HTTP response handler for thrown typed responses when response validation is enabled", async () => {
    const typedResponse = aConflictTypedResponse();
    const httpResponseHandler = vi.fn(() => ({
      statusCode: 200,
      body: { handled: true },
    }));
    const app = createTypedResponseValidationApp({
      typedResponse,
      handleHttpResponseErrors: httpResponseHandler,
    });

    const res = await app.fetch(get("/todos"));

    const data = await expectJson(res, 200);
    expect(data).toEqual({ handled: true });
    expect(httpResponseHandler).toHaveBeenCalledWith(
      typedResponse,
      expect.anything()
    );
  });

  test("validates the transformed typed response handler result before sending it", async () => {
    const app = createTypedResponseValidationApp({
      responseValidator: aValidatorThatMarksResponsesAsValidated(),
      handleHttpResponseErrors: () => ({
        statusCode: 200,
        header: { "x-response-source": "handler" },
        body: { source: "handler", stripped: true },
      }),
    });

    const res = await app.fetch(get("/todos"));

    const data = await expectJson(res, 200);
    expect(data).toEqual({ source: "validated" });
    expect(res.headers.get("x-response-source")).toBe("validator");
  });

  test("invokes the response validation handler when a transformed thrown typed response is invalid", async () => {
    const app = createTypedResponseValidationApp({
      responseValidator: invalidResponseValidator,
      handleHttpResponseErrors: () => ({
        statusCode: 409,
        body: { code: "HTTP_RESPONSE_HANDLER" },
      }),
      handleResponseValidationErrors: (_error, response, ctx) => ({
        statusCode: 422,
        body: {
          code: "INVALID_TRANSFORMED_RESPONSE",
          originalStatus: response.statusCode,
          operationId: ctx.route?.operationId,
        },
      }),
    });

    const res = await app.fetch(get("/todos"));

    const data = await expectJson(res, 422);
    expect(data).toEqual({
      code: "INVALID_TRANSFORMED_RESPONSE",
      originalStatus: 409,
      operationId: "listTodos",
    });
  });
});

describe("TypeweaverApp typed response validation fallthrough", () => {
  test("falls through to the unknown handler when a typed response handler throws", async () => {
    const typedResponse = aConflictTypedResponse();
    const onError = vi.fn();
    const handlerFailure = new TestApplicationError(
      "typed response handler failed"
    );
    const unknownHandler = vi.fn(() => ({
      statusCode: 500,
      body: { code: "CUSTOM_UNKNOWN", message: "typed response escaped" },
    }));
    const app = createTypedResponseValidationApp({
      typedResponse,
      handleHttpResponseErrors: () => {
        throw handlerFailure;
      },
      handleUnknownErrors: unknownHandler,
      onError,
    });

    const res = await app.fetch(get("/todos"));

    const data = await expectJson(res, 500);
    expect(data).toEqual({
      code: "CUSTOM_UNKNOWN",
      message: "typed response escaped",
    });
    expect(onError).toHaveBeenCalledWith(handlerFailure);
    expect(unknownHandler).toHaveBeenCalledWith(
      typedResponse,
      expect.anything()
    );
  });

  test("strips HEAD bodies after validating transformed thrown typed responses", async () => {
    const app = createTypedResponseValidationApp({
      responseValidator: aValidatorThatMarksResponsesAsValidated(),
      handleHttpResponseErrors: () => ({
        statusCode: 200,
        header: { "x-response-source": "handler" },
        body: { source: "handler" },
      }),
    });

    const res = await app.fetch(head("/todos"));

    expect(res.status).toBe(200);
    expect(res.headers.get("x-response-source")).toBe("validator");
    await expectNoBody(res);
  });

  test("returns invalid transformed typed responses when response validation handling is disabled", async () => {
    const app = createTypedResponseValidationApp({
      responseValidator: invalidResponseValidator,
      handleHttpResponseErrors: () => ({
        statusCode: 409,
        header: { "x-response-source": "handler" },
        body: { code: "HTTP_RESPONSE_HANDLER" },
      }),
      handleResponseValidationErrors: false,
    });

    const res = await app.fetch(get("/todos"));

    const data = await expectJson(res, 409);
    expect(data).toEqual({ code: "HTTP_RESPONSE_HANDLER" });
    expect(res.headers.get("x-response-source")).toBe("handler");
  });

  test("falls through to the unknown handler for thrown typed responses when HTTP response handling is disabled with response validation enabled", async () => {
    const unknownHandler = vi.fn(() => ({
      statusCode: 500,
      body: { code: "CUSTOM_UNKNOWN" },
    }));
    const app = createTypedResponseValidationApp({
      handleHttpResponseErrors: false,
      handleUnknownErrors: unknownHandler,
    });

    const res = await app.fetch(get("/todos"));

    await expectErrorResponse(res, 500, "CUSTOM_UNKNOWN");
    expect(unknownHandler).toHaveBeenCalledWith(
      expect.objectContaining({ type: "ConflictError", statusCode: 409 }),
      expect.anything()
    );
  });

  test("keeps default typed response handling silent for onError when response validation is enabled", async () => {
    const onError = vi.fn();
    const app = createTypedResponseValidationApp({
      onError,
    });

    const res = await app.fetch(get("/todos"));

    await expectErrorResponse(res, 409, "CONFLICT");
    expect(onError).not.toHaveBeenCalled();
  });
});
