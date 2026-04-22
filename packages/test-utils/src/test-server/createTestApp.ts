import type {
  IHttpResponse,
  ITypedHttpResponse,
} from "@rexeus/typeweaver-core";
import { AccountRouter } from "../test-project/output/account/AccountRouter.js";
import { AuthRouter } from "../test-project/output/auth/AuthRouter.js";
import {
  defineMiddleware,
  TypeweaverApp,
} from "../test-project/output/lib/server/index.js";
import { TodoRouter } from "../test-project/output/todo/TodoRouter.js";
import { ServerAccountHandlers } from "./handlers/ServerAccountHandlers.js";
import { ServerAuthHandlers } from "./handlers/ServerAuthHandlers.js";
import { ServerTodoHandlers } from "./handlers/ServerTodoHandlers.js";
import type {
  RequestHandler,
  TypeweaverRouterOptions,
} from "../test-project/output/lib/server/index.js";

/**
 * Configuration options for TypeweaverApp-based test instances.
 *
 * Extends the standard `TypeweaverRouterOptions` (without `requestHandlers`)
 * with options to force specific errors or override responses for testing
 * error handling and edge cases.
 */
export type TestAppOptions = {
  /** Error to throw from todo handlers (simulates handler failures). */
  readonly throwTodoError?: Error | ITypedHttpResponse;
  /** Error to throw from auth handlers. */
  readonly throwAuthError?: Error | ITypedHttpResponse;
  /** Error to throw from account handlers. */
  readonly throwAccountError?: Error | ITypedHttpResponse;
  /** Custom response to return for all requests (bypasses handlers). */
  readonly customResponses?: IHttpResponse;
  /** Maximum request body size forwarded to the app. */
  readonly maxBodySize?: number;
} & Omit<
  TypeweaverRouterOptions<Record<string, RequestHandler<any, any, any>>>,
  "requestHandlers"
>;

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
  const app = new TypeweaverApp({ maxBodySize: options?.maxBodySize });

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
    validateResponses: options?.validateResponses,
    handleHttpResponseErrors: options?.handleHttpResponseErrors,
    handleRequestValidationErrors: options?.handleRequestValidationErrors,
    handleResponseValidationErrors: options?.handleResponseValidationErrors,
    handleUnknownErrors: options?.handleUnknownErrors,
  });
  const authRouter = new AuthRouter({
    requestHandlers: new ServerAuthHandlers(options?.throwAuthError),
    validateRequests: options?.validateRequests,
    validateResponses: options?.validateResponses,
    handleHttpResponseErrors: options?.handleHttpResponseErrors,
    handleRequestValidationErrors: options?.handleRequestValidationErrors,
    handleResponseValidationErrors: options?.handleResponseValidationErrors,
    handleUnknownErrors: options?.handleUnknownErrors,
  });
  const accountRouter = new AccountRouter({
    requestHandlers: new ServerAccountHandlers(options?.throwAccountError),
    validateRequests: options?.validateRequests,
    validateResponses: options?.validateResponses,
    handleHttpResponseErrors: options?.handleHttpResponseErrors,
    handleRequestValidationErrors: options?.handleRequestValidationErrors,
    handleResponseValidationErrors: options?.handleResponseValidationErrors,
    handleUnknownErrors: options?.handleUnknownErrors,
  });

  app.route(authRouter);
  app.route(accountRouter);
  app.route(todoRouter);

  return app;
}
