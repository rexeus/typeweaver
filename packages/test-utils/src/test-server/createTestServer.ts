import type {
  IHttpResponse,
  ITypedHttpResponse,
} from "@rexeus/typeweaver-core";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { AccountHono, AuthHono, TodoHono } from "../index.js";
import { HonoAdapter } from "../test-project/output/lib/hono/index.js";
import { TestServerSetupError } from "./errors/TestServerSetupError.js";
import { AccountHandlers } from "./handlers/AccountApiHandler.js";
import { AuthHandlers } from "./handlers/AuthHandlers.js";
import { TodoHandlers } from "./handlers/TodoHandlers.js";
import type { ServerType } from "@hono/node-server";
import type { AddressInfo } from "node:net";

/**
 * Configuration options for Hono-based test servers.
 *
 * Extends the standard `TypeweaverHonoOptions` (without `requestHandlers`)
 * with options to force specific errors or override responses for testing
 * error handling and edge cases.
 */
export type TestServerOptions = {
  /** Error to throw from todo handlers (simulates handler failures). */
  readonly throwTodoError?: Error | ITypedHttpResponse;
  /** Error to throw from auth handlers. */
  readonly throwAuthError?: Error | ITypedHttpResponse;
  /** Error to throw from account handlers. */
  readonly throwAccountError?: Error | ITypedHttpResponse;
  /** Error to throw from specimen handlers. */
  readonly throwSpecimenError?: Error | ITypedHttpResponse;
  /** Custom response to return for all requests (bypasses handlers). */
  readonly customResponses?: IHttpResponse;
  /** Delay the GetTodo handler for cancellation integration tests. */
  readonly getTodoDelayMs?: number;
  /** Observe an accepted request before routing it. */
  readonly onRequest?: (request: Request) => void;
  /**
   * Request validation mode applied to every mounted router.
   *
   * Optional here because this helper chooses the mode at construction time;
   * each generated router is then built as `<boolean>` with an explicit mode so
   * its handler types match runtime behavior.
   */
  readonly validateRequests?: boolean;
} & Omit<
  ConstructorParameters<typeof TodoHono<boolean>>[0],
  "requestHandlers" | "validateRequests"
>;

/**
 * Result returned by {@link createTestServer} and {@link createPrefixedTestServer}.
 */
export type CreateTestServerResult = {
  /** The running HTTP server instance. */
  readonly server: ServerType;
  /** The base URL (including port) to use for requests against this server. */
  readonly baseUrl: string;
};

/**
 * Creates a Hono app with all generated test routers (Todo, Auth, Account) mounted.
 *
 * Used internally by {@link createTestServer} and can be used directly
 * for testing request/response handling without starting an HTTP server.
 *
 * @param options - Optional test server configuration
 * @returns A configured Hono app instance
 */
export function createTestHono(options?: TestServerOptions): Hono {
  const app = new Hono();
  const adapter = new HonoAdapter();

  app.use("*", async (context, next) => {
    options?.onRequest?.(context.req.raw);
    if (options?.customResponses) {
      return adapter.toResponse(options.customResponses);
    }

    return next();
  });

  const validateRequests = options?.validateRequests ?? true;

  const todoRouter = new TodoHono<boolean>({
    requestHandlers: new TodoHandlers(
      options?.throwTodoError,
      options?.getTodoDelayMs
    ),
    ...options,
    validateRequests,
  });
  const authRouter = new AuthHono<boolean>({
    requestHandlers: new AuthHandlers(options?.throwAuthError),
    ...options,
    validateRequests,
  });
  const accountRouter = new AccountHono<boolean>({
    requestHandlers: new AccountHandlers(options?.throwAccountError),
    ...options,
    validateRequests,
  });

  app.route("/", authRouter);
  app.route("/", accountRouter);
  app.route("/", todoRouter);

  return app;
}

function getServerPort(server: ServerType): number {
  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new TestServerSetupError(
      "Expected test server to listen on a TCP port"
    );
  }

  return (address as AddressInfo).port;
}

/**
 * Starts a Hono-based test HTTP server on a random available port.
 *
 * Mounts all generated routers (Todo, Auth, Account) and returns
 * the server instance and base URL for use in integration tests.
 *
 * @param options - Optional test server configuration
 * @returns The running server and its base URL
 */
export async function createTestServer(
  options?: TestServerOptions
): Promise<CreateTestServerResult> {
  const app = createTestHono(options);

  const server = serve({
    fetch: app.fetch,
    port: 0,
  });
  const port = getServerPort(server);

  return {
    server,
    baseUrl: `http://localhost:${port}`,
  };
}

/**
 * Starts a Hono-based test HTTP server with all routes mounted under a path prefix.
 *
 * Useful for testing client `baseURL` handling and path prefix scenarios.
 *
 * @param prefix - Path prefix to mount all routers under (e.g., `/api/v1`)
 * @param options - Optional test server configuration
 * @returns The running server and its base URL (including prefix)
 */
export async function createPrefixedTestServer(
  prefix: string,
  options?: TestServerOptions
): Promise<CreateTestServerResult> {
  const root = new Hono();
  const testHono = createTestHono(options);
  root.route(prefix, testHono);

  const server = serve({ fetch: root.fetch, port: 0 });
  const port = getServerPort(server);

  return {
    server,
    baseUrl: `http://localhost:${port}${prefix}`,
  };
}
