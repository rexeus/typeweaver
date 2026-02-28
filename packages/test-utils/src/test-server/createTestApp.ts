import { HttpResponse } from "@rexeus/typeweaver-core";
import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { AccountRouter } from "../test-project/output/account/AccountRouter";
import { AuthRouter } from "../test-project/output/auth/AuthRouter";
import {
  defineMiddleware,
  TypeweaverApp,
} from "../test-project/output/lib/server";
import { TodoRouter } from "../test-project/output/todo/TodoRouter";
import { ServerAccountHandlers } from "./handlers/ServerAccountHandlers";
import { ServerAuthHandlers } from "./handlers/ServerAuthHandlers";
import { ServerTodoHandlers } from "./handlers/ServerTodoHandlers";
import type { TypeweaverRouterOptions } from "../test-project/output/lib/server";

/**
 * Configuration options for TypeweaverApp-based test instances.
 *
 * Extends the standard `TypeweaverRouterOptions` (without `requestHandlers`)
 * with options to force specific errors or override responses for testing
 * error handling and edge cases.
 */
export type TestAppOptions = {
  /** Error to throw from todo handlers (simulates handler failures). */
  readonly throwTodoError?: Error | HttpResponse;
  /** Error to throw from auth handlers. */
  readonly throwAuthError?: Error | HttpResponse;
  /** Error to throw from account handlers. */
  readonly throwAccountError?: Error | HttpResponse;
  /** Custom response to return for all requests (bypasses handlers). */
  readonly customResponses?: HttpResponse | IHttpResponse;
} & Omit<TypeweaverRouterOptions<unknown>, "requestHandlers">;

/**
 * Creates a TypeweaverApp with all generated test routers (Todo, Auth, Account) mounted.
 *
 * Uses the framework-agnostic `TypeweaverApp` (from the server plugin) instead of Hono.
 * The returned app exposes a `fetch()` method compatible with Bun, Deno,
 * and Cloudflare Workers — or can be used directly in tests via `app.fetch(request)`.
 *
 * @param options - Optional test app configuration
 * @returns A configured TypeweaverApp instance
 */
export function createTestApp(options?: TestAppOptions): TypeweaverApp {
  const app = new TypeweaverApp();

  if (options?.customResponses) {
    app.use(
      defineMiddleware(async (_ctx, _next) => {
        return options.customResponses!;
      })
    );
  }

  const todoRouter = new TodoRouter({
    requestHandlers: new ServerTodoHandlers(options?.throwTodoError),
    validateRequests: options?.validateRequests,
    handleHttpResponseErrors: options?.handleHttpResponseErrors,
    handleValidationErrors: options?.handleValidationErrors,
    handleUnknownErrors: options?.handleUnknownErrors,
  });
  const authRouter = new AuthRouter({
    requestHandlers: new ServerAuthHandlers(options?.throwAuthError),
    validateRequests: options?.validateRequests,
    handleHttpResponseErrors: options?.handleHttpResponseErrors,
    handleValidationErrors: options?.handleValidationErrors,
    handleUnknownErrors: options?.handleUnknownErrors,
  });
  const accountRouter = new AccountRouter({
    requestHandlers: new ServerAccountHandlers(options?.throwAccountError),
    validateRequests: options?.validateRequests,
    handleHttpResponseErrors: options?.handleHttpResponseErrors,
    handleValidationErrors: options?.handleValidationErrors,
    handleUnknownErrors: options?.handleUnknownErrors,
  });

  app.route(authRouter);
  app.route(accountRouter);
  app.route(todoRouter);

  return app;
}
