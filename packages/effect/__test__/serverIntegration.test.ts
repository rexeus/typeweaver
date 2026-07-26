import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { Data, Effect, Layer } from "effect";
import { AccountRouter } from "test-utils/src/test-project/output/account/AccountRouter.js";
import { adaptAccountEffectHandlers } from "test-utils/src/test-project/output/account/EffectAccountApiHandler.js";
import { TypeweaverApp } from "test-utils/src/test-project/output/lib/server/index.js";
import { describe, expect, test } from "vitest";
import {
  createEffectHandlerRuntime,
  EffectHandlerDefectError,
  EffectHandlerInterruptedError,
} from "../src/index.js";
import type { EffectHandlerRuntime } from "../src/index.js";
import type {
  EffectAccountApiHandler,
  EffectAccountErrorMappers,
} from "test-utils/src/test-project/output/account/EffectAccountApiHandler.js";

class AccountFailure extends Data.TaggedError("AccountFailure")<{
  readonly reason: string;
}> {}

const errorMappers: EffectAccountErrorMappers<AccountFailure> = {
  handleRegisterAccountRequest: () => ({
    type: "InternalServerError",
    statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
    header: { "Content-Type": "application/json" },
    body: {
      message: "Internal server error occurred",
      code: "INTERNAL_SERVER_ERROR",
    },
  }),
};

const accountRequest = (controller = new AbortController()): Request =>
  new Request("http://localhost/accounts", {
    method: "POST",
    signal: controller.signal,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      email: "effect@example.com",
      password: "not-a-real-secret",
    }),
  });

const application = (
  runtime: EffectHandlerRuntime<never>,
  handlers: EffectAccountApiHandler<AccountFailure, never>,
  onError: (error: unknown) => void
): TypeweaverApp =>
  new TypeweaverApp({ onError }).route(
    new AccountRouter({
      requestHandlers: adaptAccountEffectHandlers(
        runtime,
        handlers,
        errorMappers
      ),
      validateRequests: true,
      validateResponses: true,
    })
  );

describe("Effect adapter and Fetch-native server integration", () => {
  test("reports a sanitized defect through the existing server boundary", async () => {
    let observedError: unknown;
    const runtime = createEffectHandlerRuntime(Layer.empty);
    const handlers: EffectAccountApiHandler<AccountFailure, never> = {
      handleRegisterAccountRequest: () =>
        Effect.die(new Error("database-password=secret")),
    };
    const app = application(runtime, handlers, error => {
      observedError = error;
    });

    const response = await app.fetch(accountRequest());

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("database-password=secret");
    expect(observedError).toBeInstanceOf(EffectHandlerDefectError);
    await runtime.dispose();
  });

  test("interrupts the handler from the incoming Fetch request signal", async () => {
    const controller = new AbortController();
    const started = Promise.withResolvers<void>();
    let interrupted = false;
    let observedError: unknown;
    const runtime = createEffectHandlerRuntime(Layer.empty);
    const handlers: EffectAccountApiHandler<AccountFailure, never> = {
      handleRegisterAccountRequest: () =>
        Effect.sync(started.resolve).pipe(
          Effect.zipRight(Effect.never),
          Effect.onInterrupt(() =>
            Effect.sync(() => {
              interrupted = true;
            })
          )
        ),
    };
    const app = application(runtime, handlers, error => {
      observedError = error;
    });

    const pending = app.fetch(accountRequest(controller));
    await started.promise;
    controller.abort();
    const response = await pending;

    expect(response.status).toBe(500);
    expect(interrupted).toBe(true);
    expect(observedError).toBeInstanceOf(EffectHandlerInterruptedError);
    await runtime.dispose();
  });
});
