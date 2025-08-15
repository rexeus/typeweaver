import { Hono } from "hono";
import { TodoHono, AuthHono, AccountHono, SpecimenHono } from "..";
import { TodoHandlers } from "./handlers/TodoHandlers";
import { AuthHandlers } from "./handlers/AuthHandlers";
import { AccountHandlers } from "./handlers/AccountApiHandler";
import { SpecimenHandlers } from "./handlers/SpecimenHandlers";
import { serve, type ServerType } from "@hono/node-server";
import { HttpResponse, type IHttpResponse } from "@rexeus/typeweaver-core";
import getPort, { portNumbers } from "get-port";
import type { TypeweaverHonoOptions } from "../test-project/output/lib/hono";
import { HonoAdapter } from "../test-project/output/lib/hono";

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
  const specimenRouter = new SpecimenHono({
    requestHandlers: new SpecimenHandlers(options?.throwSpecimenError),
    ...options,
  });

  app.route("/", authRouter);
  app.route("/", accountRouter);
  app.route("/", todoRouter);
  app.route("/", specimenRouter);

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
