import { serve } from "@hono/node-server";
import { HttpResponse } from "@rexeus/typeweaver-core";
import getPort, { portNumbers } from "get-port";
import { Hono } from "hono";
import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { AccountHono, AuthHono, TodoHono } from "..";
import { HonoAdapter } from "../test-project/output/lib/hono";
import { AccountHandlers } from "./handlers/AccountApiHandler";
import { AuthHandlers } from "./handlers/AuthHandlers";
import { TodoHandlers } from "./handlers/TodoHandlers";
import type { TypeweaverHonoOptions } from "../test-project/output/lib/hono";
import type { ServerType } from "@hono/node-server";

export type TestServerOptions = {
  readonly throwTodoError?: Error | HttpResponse;
  readonly throwAuthError?: Error | HttpResponse;
  readonly throwAccountError?: Error | HttpResponse;
  readonly throwSpecimenError?: Error | HttpResponse;
  readonly customResponses?: HttpResponse | IHttpResponse;
} & Omit<TypeweaverHonoOptions<unknown>, "requestHandlers">;

export type CreateTestServerResult = {
  readonly server: ServerType;
  readonly baseUrl: string;
};

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
