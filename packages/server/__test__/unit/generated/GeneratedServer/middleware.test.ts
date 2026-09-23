import {
  createCreateTodoRequest,
  createTestApp,
  defineMiddleware,
} from "test-utils";
import { describe, expect, test } from "vitest";
import {
  BASE_URL,
  buildFetchRequest,
  expectJson,
  withBodyFields,
} from "../../../helpers.js";

describe("Generated Server middleware", () => {
  test("passes middleware state in registration order", async () => {
    const order: string[] = [];
    let capturedTrace: readonly string[] | undefined;
    const app = createTestApp()
      .use(
        defineMiddleware<{ trace: readonly string[] }>(async (_ctx, next) => {
          order.push("first");
          return next({ trace: ["first"] });
        })
      )
      .use(
        defineMiddleware<{}, { trace: readonly string[] }>(
          async (ctx, next) => {
            order.push("second");
            capturedTrace = ctx.state.get("trace");
            return next();
          }
        )
      );
    const requestData = createCreateTodoRequest();

    await app.fetch(buildFetchRequest(`${BASE_URL}/todos`, requestData));

    expect(order).toEqual(["first", "second"]);
    expect(capturedTrace).toEqual(["first"]);
  });

  test("runs middleware before returning 404 responses", async () => {
    const app = createTestApp();
    let middlewareExecuted = false;
    app.use(
      defineMiddleware(async (_ctx, next) => {
        middlewareExecuted = true;
        return next();
      })
    );

    await app.fetch(new Request(`${BASE_URL}/unknown-path`, { method: "GET" }));

    expect(middlewareExecuted).toBe(true);
  });

  test("returns middleware short-circuit responses before generated handlers", async () => {
    const app = createTestApp();
    app.use(
      defineMiddleware(async (_ctx, _next) => ({
        statusCode: 418,
        body: { message: "I'm a teapot" },
      }))
    );
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 418);
    expect(data["message"]).toBe("I'm a teapot");
  });

  test("returns middleware short-circuit responses before request validation", async () => {
    const app = createTestApp();
    app.use(
      defineMiddleware(async (_ctx, _next) => ({
        statusCode: 418,
        body: { message: "I'm still a teapot" },
      }))
    );
    const requestData = withBodyFields(createCreateTodoRequest(), {
      priority: "INVALID_PRIORITY",
    });

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 418);
    expect(data["message"]).toBe("I'm still a teapot");
    expect(data["code"]).toBeUndefined();
  });
});
