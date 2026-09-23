import { RequestValidationError } from "@rexeus/typeweaver-core";
import type { ITypedHttpResponse } from "@rexeus/typeweaver-core";
import { TestApplicationError } from "test-utils";
import { describe, expect, test, vi } from "vitest";
import { expectErrorResponse, get, post } from "../../helpers.js";
import {
  createApp,
  createValidatingApp,
  withConsoleErrorSpy,
} from "./fixtures.js";

describe("Error Handler Fallthrough", () => {
  test("should fall through to unknown handler when validation handler is disabled", async () => {
    const unknownHandler = vi.fn((_err: unknown) => ({
      statusCode: 500,
      body: { code: "CUSTOM_UNKNOWN", message: "Caught by unknown handler" },
    }));
    const app = createValidatingApp({
      handleRequestValidationErrors: false,
      handleUnknownErrors: unknownHandler,
    });

    const res = await app.fetch(post("/todos", {}));

    await expectErrorResponse(res, 500, "CUSTOM_UNKNOWN");
    expect(unknownHandler).toHaveBeenCalledOnce();
    expect(unknownHandler).toHaveBeenCalledWith(
      expect.any(RequestValidationError),
      expect.anything()
    );
  });

  test("should fall through to unknown handler when HttpResponse handler is disabled", async () => {
    const unknownHandler = vi.fn((_err: unknown) => ({
      statusCode: 500,
      body: { code: "CUSTOM_UNKNOWN", message: "Caught by unknown handler" },
    }));
    const app = createApp(
      {
        validateResponses: false,
        handleHttpResponseErrors: false,
        handleUnknownErrors: unknownHandler,
      },
      {
        handleCreateTodo: async () => {
          throw {
            type: "ConflictError",
            statusCode: 409,
            header: {},
            body: { code: "CONFLICT" },
          } satisfies ITypedHttpResponse;
        },
      }
    );

    const res = await app.fetch(post("/todos", {}));

    await expectErrorResponse(res, 500, "CUSTOM_UNKNOWN");
    expect(unknownHandler).toHaveBeenCalledOnce();
    expect(unknownHandler).toHaveBeenCalledWith(
      expect.objectContaining({ type: "ConflictError", statusCode: 409 }),
      expect.anything()
    );
  });

  test("should return 500 via handler path when defaultUnknownHandler onError throws", async () => {
    const app = createApp(
      undefined,
      {
        handleGetTodos: async () => {
          throw new TestApplicationError("Handler failure");
        },
      },
      {
        onError: () => {
          throw new TestApplicationError("onError also failed");
        },
      }
    );

    await withConsoleErrorSpy(async spy => {
      const res = await app.fetch(get("/todos"));

      await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
      expect(spy).toHaveBeenCalled();
    });
  });
});

describe("TypeweaverApp error-handler safety net", () => {
  test("falls through to the safety net when the custom unknown handler throws", async () => {
    const onError = vi.fn();
    const routeFailure = new TestApplicationError("unexpected failure");
    const app = createApp(
      {
        handleUnknownErrors: () => {
          throw new TestApplicationError("custom unknown handler failed");
        },
      },
      {
        handleGetTodos: async () => {
          throw routeFailure;
        },
      },
      { onError }
    );

    const res = await app.fetch(get("/todos"));

    await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: routeFailure["message"] })
    );
  });

  test("should call onError for errors that escape to the safety net", async () => {
    const onError = vi.fn();
    const app = createApp(
      { handleUnknownErrors: false },
      {
        handleGetTodos: async () => {
          throw new TestApplicationError("Unhandled");
        },
      },
      { onError }
    );

    const res = await app.fetch(get("/todos"));

    expect(res.status).toBe(500);
    expect(onError).toHaveBeenCalledOnce();
  });

  test("should bubble RequestValidationError to safety net when both validation and unknown handlers are disabled", async () => {
    const onError = vi.fn();
    const app = createValidatingApp(
      {
        handleRequestValidationErrors: false,
        handleUnknownErrors: false,
      },
      undefined,
      { onError }
    );

    const res = await app.fetch(post("/todos", {}));

    await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(expect.any(RequestValidationError));
  });

  test("should bubble HttpResponse to safety net when both http response and unknown handlers are disabled", async () => {
    const onError = vi.fn();
    const app = createApp(
      {
        validateResponses: false,
        handleHttpResponseErrors: false,
        handleUnknownErrors: false,
      },
      {
        handleCreateTodo: async () => {
          throw {
            type: "ConflictError",
            statusCode: 409,
            header: {},
            body: { code: "CONFLICT" },
          } satisfies ITypedHttpResponse;
        },
      },
      { onError }
    );

    const res = await app.fetch(post("/todos", { title: "dup" }));

    await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ type: "ConflictError", statusCode: 409 })
    );
  });
});

describe("TypeweaverApp error reporter failures", () => {
  test("should return 500 when error handler throws", async () => {
    const app = createValidatingApp({
      handleRequestValidationErrors: () => {
        throw new TestApplicationError("Handler crashed");
      },
    });

    const res = await app.fetch(post("/todos", {}));

    await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
  });

  test("should still return 500 when onError throws", async () => {
    const app = createApp(
      undefined,
      {
        handleGetTodos: async () => {
          throw new TestApplicationError("Unexpected failure");
        },
      },
      {
        onError: () => {
          throw new TestApplicationError("Observer crashed");
        },
      }
    );

    const res = await app.fetch(get("/todos"));

    await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
  });

  test("logs through console.error as a last resort when onError throws in the safety net", async () => {
    const originalError = new TestApplicationError("Unexpected failure");
    const onErrorFailure = new TestApplicationError("Observer crashed");
    const app = createApp(
      undefined,
      {
        handleGetTodos: async () => {
          throw originalError;
        },
      },
      {
        onError: () => {
          throw onErrorFailure;
        },
      }
    );

    await withConsoleErrorSpy(async spy => {
      await app.fetch(get("/todos"));

      expect(spy).toHaveBeenCalledWith(
        "TypeweaverApp: onError callback threw while handling error",
        expect.objectContaining({ onErrorFailure, originalError })
      );
    });
  });

  test("logs through console.error as a last resort when onError throws in the unknown-error handler", async () => {
    const originalError = new TestApplicationError("Handler failure");
    const onErrorFailure = new TestApplicationError("onError crashed");
    const app = createApp(
      undefined,
      {
        handleGetTodos: async () => {
          throw originalError;
        },
      },
      {
        onError: () => {
          throw onErrorFailure;
        },
      }
    );

    await withConsoleErrorSpy(async spy => {
      const res = await app.fetch(get("/todos"));

      expect(res.status).toBe(500);
      expect(spy).toHaveBeenCalledWith(
        "TypeweaverApp: onError callback threw while handling error",
        expect.objectContaining({ onErrorFailure, originalError })
      );
    });
  });
});
