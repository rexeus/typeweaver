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
  ErasedRequestHandler,
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
  /**
   * Request validation mode applied to every mounted router.
   *
   * Optional here because this helper chooses the mode at construction time;
   * each generated router is then built as `<..., boolean>` with an explicit
   * mode so its handler types match runtime behavior.
   */
  readonly validateRequests?: boolean;
} & Omit<
  TypeweaverRouterOptions<Record<string, ErasedRequestHandler>, boolean>,
  "requestHandlers" | "validateRequests"
>;

export const DEFAULT_RUNTIME_TEST_APP_OPTIONS = {
  maxBodySize: 64,
  validateRequests: false,
  validateResponses: false,
} satisfies Pick<
  TestAppOptions,
  "maxBodySize" | "validateRequests" | "validateResponses"
>;

type SharedRouterOptions = Omit<
  TypeweaverRouterOptions<Record<string, ErasedRequestHandler>, boolean>,
  "requestHandlers"
>;

function createSharedRouterOptions(
  options?: TestAppOptions
): SharedRouterOptions {
  const shared: SharedRouterOptions = {
    validateRequests: options?.validateRequests ?? true,
  };
  const optionalEntries = [
    ["validateResponses", options?.validateResponses],
    ["handleHttpResponseErrors", options?.handleHttpResponseErrors],
    ["handleRequestValidationErrors", options?.handleRequestValidationErrors],
    ["handleResponseValidationErrors", options?.handleResponseValidationErrors],
    ["handleUnknownErrors", options?.handleUnknownErrors],
  ] as const;

  for (const [key, value] of optionalEntries) {
    if (value !== undefined) {
      Object.assign(shared, { [key]: value });
    }
  }

  return shared;
}

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
  const app = new TypeweaverApp(
    options?.maxBodySize === undefined
      ? {}
      : { maxBodySize: options.maxBodySize }
  );
  const customResponse = options?.customResponses;
  const sharedRouterOptions = createSharedRouterOptions(options);

  if (customResponse !== undefined) {
    app.use(
      defineMiddleware(async (_ctx, _next) => {
        return customResponse;
      })
    );
  }

  const todoRouter = new TodoRouter<Record<string, unknown>, boolean>({
    requestHandlers: new ServerTodoHandlers(options?.throwTodoError),
    ...sharedRouterOptions,
  });
  const authRouter = new AuthRouter<Record<string, unknown>, boolean>({
    requestHandlers: new ServerAuthHandlers(options?.throwAuthError),
    ...sharedRouterOptions,
  });
  const accountRouter = new AccountRouter<Record<string, unknown>, boolean>({
    requestHandlers: new ServerAccountHandlers(options?.throwAccountError),
    ...sharedRouterOptions,
  });

  app.route(authRouter);
  app.route(accountRouter);
  app.route(todoRouter);

  return app;
}

export function createRuntimeTestApp(): TypeweaverApp {
  return createTestApp(DEFAULT_RUNTIME_TEST_APP_OPTIONS);
}
