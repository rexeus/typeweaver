import { HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import type { IHttpRequest, IHttpResponse } from "@rexeus/typeweaver-core";
import { Context, Data, Effect, HashMap, Layer, Option } from "effect";
import { describe, expect, test } from "vitest";
import {
  createEffectHandlerRuntime,
  EffectHandlerDefectError,
  EffectHandlerInterruptedError,
} from "../src/index.js";
import type {
  EffectHandlerErrorMapper,
  EffectRequestHandler,
} from "../src/index.js";

type TestContext = {
  readonly signal: AbortSignal;
  readonly route: {
    readonly operationId: string;
    readonly method: string;
    readonly path: string;
  };
};

const request: IHttpRequest = {
  method: HttpMethod.GET,
  path: "/todos",
};

const response: IHttpResponse = {
  statusCode: HttpStatusCode.OK,
  body: { ok: true },
};

const context = (controller = new AbortController()): TestContext => ({
  signal: controller.signal,
  route: {
    operationId: "ListTodos",
    method: HttpMethod.GET,
    path: "/todos",
  },
});

const impossibleMapper: EffectHandlerErrorMapper<
  never,
  IHttpResponse,
  TestContext
> = () => response;

class Greeting extends Context.Tag("TypeWeaverTest/Greeting")<
  Greeting,
  {
    readonly render: (name: string) => string;
  }
>() {}

class MissingTodo extends Data.TaggedError("MissingTodo")<{
  readonly id: string;
}> {}

describe("Effect handler runtime", () => {
  test("owns one scoped Layer and releases it exactly once", async () => {
    let acquisitions = 0;
    let releases = 0;
    const layer = Layer.scoped(
      Greeting,
      Effect.acquireRelease(
        Effect.sync(() => {
          acquisitions += 1;
          return {
            render: (name: string) => `hello ${name}`,
          };
        }),
        () =>
          Effect.sync(() => {
            releases += 1;
          })
      )
    );
    const runtime = createEffectHandlerRuntime(layer);
    const handler: EffectRequestHandler<
      IHttpRequest,
      IHttpResponse,
      never,
      Greeting,
      TestContext
    > = () =>
      Effect.gen(function* () {
        const greeting = yield* Greeting;
        return {
          statusCode: HttpStatusCode.OK,
          body: { message: greeting.render("TypeWeaver") },
        };
      });

    const first = await runtime.run(
      handler,
      request,
      context(),
      impossibleMapper
    );
    const second = await runtime.run(
      handler,
      request,
      context(),
      impossibleMapper
    );

    expect(first.body).toEqual({ message: "hello TypeWeaver" });
    expect(second.body).toEqual({ message: "hello TypeWeaver" });
    expect(acquisitions).toBe(1);
    await Promise.all([runtime.dispose(), runtime.dispose()]);
    expect(releases).toBe(1);
  });

  test("maps typed failures through the operation response mapper", async () => {
    const runtime = createEffectHandlerRuntime(Layer.empty);
    const handler: EffectRequestHandler<
      IHttpRequest,
      IHttpResponse,
      MissingTodo,
      never,
      TestContext
    > = () => Effect.fail(new MissingTodo({ id: "todo-1" }));
    const mapper: EffectHandlerErrorMapper<
      MissingTodo,
      IHttpResponse,
      TestContext
    > = error => ({
      statusCode: HttpStatusCode.NOT_FOUND,
      body: { code: error._tag, id: error.id },
    });

    await expect(
      runtime.run(handler, request, context(), mapper)
    ).resolves.toEqual({
      statusCode: HttpStatusCode.NOT_FOUND,
      body: { code: "MissingTodo", id: "todo-1" },
    });
    await runtime.dispose();
  });
});

describe("Effect handler runtime failure boundaries", () => {
  test("sanitizes defects at the existing unknown-error boundary", async () => {
    const runtime = createEffectHandlerRuntime(Layer.empty);
    const handler: EffectRequestHandler<
      IHttpRequest,
      IHttpResponse,
      never,
      never,
      TestContext
    > = () => Effect.die(new Error("database-password=secret"));

    const failure = await runtime
      .run(handler, request, context(), impossibleMapper)
      .catch(error => error);

    expect(failure).toBeInstanceOf(EffectHandlerDefectError);
    expect(failure).toMatchObject({
      _tag: "EffectHandlerDefectError",
      operationId: "ListTodos",
      message: "Effect handler 'ListTodos' failed unexpectedly.",
    });
    expect(String(failure)).not.toContain("database-password=secret");
    await runtime.dispose();
  });

  test("interrupts the running Effect when the Fetch signal aborts", async () => {
    const controller = new AbortController();
    const started = Promise.withResolvers<void>();
    let interrupted = false;
    const runtime = createEffectHandlerRuntime(Layer.empty);
    const handler: EffectRequestHandler<
      IHttpRequest,
      IHttpResponse,
      never,
      never,
      TestContext
    > = () =>
      Effect.sync(started.resolve).pipe(
        Effect.zipRight(Effect.never),
        Effect.onInterrupt(() =>
          Effect.sync(() => {
            interrupted = true;
          })
        )
      );

    const running = runtime.run(
      handler,
      request,
      context(controller),
      impossibleMapper
    );
    await started.promise;
    controller.abort();

    await expect(running).rejects.toBeInstanceOf(EffectHandlerInterruptedError);
    expect(interrupted).toBe(true);
    await runtime.dispose();
  });
});

describe("Effect handler runtime observability", () => {
  test("annotates the operation span and structured log context", async () => {
    let spanName: string | undefined;
    let spanOperation: unknown;
    let logOperation: unknown;
    let logMethod: unknown;
    let logRoute: unknown;
    const runtime = createEffectHandlerRuntime(Layer.empty);
    const handler: EffectRequestHandler<
      IHttpRequest,
      IHttpResponse,
      never,
      never,
      TestContext
    > = () =>
      Effect.gen(function* () {
        const span = yield* Effect.orDie(Effect.currentSpan);
        const annotations = yield* Effect.logAnnotations;
        spanName = span.name;
        spanOperation = span.attributes.get("typeweaver.operationId");
        logOperation = Option.getOrUndefined(
          HashMap.get(annotations, "typeweaver.operationId")
        );
        logMethod = Option.getOrUndefined(
          HashMap.get(annotations, "http.request.method")
        );
        logRoute = Option.getOrUndefined(
          HashMap.get(annotations, "http.route")
        );
        return response;
      });

    await runtime.run(handler, request, context(), impossibleMapper);

    expect(spanName).toBe("typeweaver.handler.ListTodos");
    expect(spanOperation).toBe("ListTodos");
    expect(logOperation).toBe("ListTodos");
    expect(logMethod).toBe(HttpMethod.GET);
    expect(logRoute).toBe("/todos");
    await runtime.dispose();
  });
});
