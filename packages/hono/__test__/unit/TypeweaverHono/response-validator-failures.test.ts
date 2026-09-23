import { HttpStatusCode } from "@rexeus/typeweaver-core";
import type {
  IHttpResponse,
  IRawHttpRequest,
  IRequestValidator,
  IResponseValidator,
} from "@rexeus/typeweaver-core";
import { TestApplicationError } from "test-utils";
import { describe, expect, expectTypeOf, test, vi } from "vitest";
import { TypeweaverHono } from "../../../src/lib/TypeweaverHono.js";
import { expectErrorResponse } from "../../helpers.js";
import type { HonoRequestHandler } from "../../../src/lib/HonoRequestHandler.js";
import type { TypeweaverHonoOptions } from "../../../src/lib/honoTypes.js";
import type { Context, Env } from "hono";
import type { HonoOptions } from "hono/hono-base";
import type { BlankEnv, BlankSchema } from "hono/types";

type ListHandlers = {
  readonly handleListTodosRequest: HonoRequestHandler<
    IRawHttpRequest,
    IHttpResponse
  >;
};

const passThroughRequestValidator: IRequestValidator = {
  validate: request => request,
  safeValidate: request => ({ isValid: true, data: request }),
};

class ListTodosHono extends TypeweaverHono<
  ListHandlers,
  BlankEnv,
  BlankSchema,
  "/",
  false
> {
  public constructor(
    options: TypeweaverHonoOptions<ListHandlers, BlankEnv, false> & {
      readonly responseValidator: IResponseValidator;
    }
  ) {
    super(options);
    this.get("/todos", async (context: Context) =>
      this.handleRequest({
        context,
        operationId: "ListTodos",
        requestValidator: passThroughRequestValidator,
        responseValidator: options.responseValidator,
        handler: this.requestHandlers.handleListTodosRequest,
      })
    );
  }
}

describe("TypeweaverHono response validator failures", () => {
  test("routes a thrown response validator failure through the unknown error handler", async () => {
    const validatorFailure = new TestApplicationError(
      "response validation failed"
    );
    const handleUnknownErrors = vi.fn(() => ({
      statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
      body: { code: "CUSTOM_UNKNOWN" },
    }));
    const app = new ListTodosHono({
      validateRequests: false,
      requestHandlers: {
        handleListTodosRequest: async () => ({
          statusCode: HttpStatusCode.OK,
          body: [],
        }),
      },
      responseValidator: {
        validate: () => {
          throw validatorFailure;
        },
        safeValidate: () => {
          throw validatorFailure;
        },
      },
      handleUnknownErrors,
    });

    const response = await app.request("http://localhost/todos");

    await expectErrorResponse(response, 500, "CUSTOM_UNKNOWN");
    expect(handleUnknownErrors).toHaveBeenCalledWith(
      validatorFailure,
      expect.anything()
    );
  });
});

describe("TypeweaverHono option forwarding", () => {
  test("forwards every Hono constructor option key", () => {
    // `TypeweaverHono` forwards Hono's own option keys by name. When Hono adds
    // an option, this assertion fails so the constructor can forward it.
    expectTypeOf<keyof HonoOptions<Env>>().toEqualTypeOf<
      "strict" | "router" | "getPath"
    >();
  });
});
