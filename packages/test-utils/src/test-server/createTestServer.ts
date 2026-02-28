import { HttpResponse } from "@rexeus/typeweaver-core";
import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { serve } from "@hono/node-server";
import getPort, { portNumbers } from "get-port";
import { Hono } from "hono";
import { AccountHono, AuthHono, TodoHono } from "../";
import { HonoAdapter } from "../test-project/output/lib/hono";
import { AccountHandlers } from "./handlers/AccountApiHandler";
import { AuthHandlers } from "./handlers/AuthHandlers";
import { TodoHandlers } from "./handlers/TodoHandlers";
import type { TypeweaverHonoOptions } from "../test-project/output/lib/hono";
import type { ServerType } from "@hono/node-server";

/**
 * Configuration options for Hono-based test servers.
 *
 * Extends the standard `TypeweaverHonoOptions` (without `requestHandlers`)
 * with options to force specific errors or override responses for testing
 * error handling and edge cases.
 */
export type TestServerOptions = {
  /** Error to throw from todo handlers (simulates handler failures). */
  readonly throwTodoError?: Error | HttpResponse;
  /** Error to throw from auth handlers. */
  readonly throwAuthError?: Error | HttpResponse;
  /** Error to throw from account handlers. */
  readonly throwAccountError?: Error | HttpResponse;
  /** Error to throw from specimen handlers. */
  readonly throwSpecimenError?: Error | HttpResponse;
  /** Custom response to return for all requests (bypasses handlers). */
  readonly customResponses?: HttpResponse | IHttpResponse;
} & Omit<TypeweaverHonoOptions<unknown>, "requestHandlers">;

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

  app.use("*", async (c, next) => {
    if (options?.customResponses) {
      return adapter.toResponse(options.customResponses);
    }

    return next();
  });

  const todoRouter = new TodoHono({
    requestHandlers: new TodoHandlers(options?.throwTodoError),
    ...options,
  });
  const authRouter = new AuthHono({
    requestHandlers: new AuthHandlers(options?.throwAuthError),
    ...options,
  });
  const accountRouter = new AccountHono({
    requestHandlers: new AccountHandlers(options?.throwAccountError),
    ...options,
  });

  app.route("/", authRouter);
  app.route("/", accountRouter);
  app.route("/", todoRouter);

  return app;
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
  const port = await getPort({ port: portNumbers(3000, 3100) });

  const app = createTestHono(options);

  const server = serve({
    fetch: app.fetch,
    port,
  });

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
  const port = await getPort({ port: portNumbers(3000, 3100) });

  const root = new Hono();
  const testHono = createTestHono(options);
  root.route(prefix, testHono);

  const server = serve({ fetch: root.fetch, port });

  return {
    server,
    baseUrl: `http://localhost:${port}${prefix}`,
  };
}
