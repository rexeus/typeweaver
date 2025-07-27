import { Hono } from "hono";
import { TodoHono, AuthHono, AccountHono, SpecimenHono } from "..";
import { TodoHandlers } from "./handlers/TodoHandlers";
import { AuthHandlers } from "./handlers/AuthHandlers";
import { AccountHandlers } from "./handlers/AccountApiHandler";
import { SpecimenHandlers } from "./handlers/SpecimenHandlers";
import { serve, type ServerType } from "@hono/node-server";
import { HttpResponse } from "@rexeus/typeweaver-core";
import getPort, { portNumbers } from "get-port";

export type TestServerOptions = {
  readonly todoError?: Error | HttpResponse;
  readonly authError?: Error | HttpResponse;
  readonly accountError?: Error | HttpResponse;
  readonly specimenError?: Error | HttpResponse;
};

export type CreateTestServerResult = {
  readonly server: ServerType;
  readonly baseUrl: string;
};

export function createTestHono(options?: TestServerOptions): Hono {
  const app = new Hono();

  const todoRouter = new TodoHono({
    requestHandlers: new TodoHandlers(options?.todoError),
  });
  const authRouter = new AuthHono({
    requestHandlers: new AuthHandlers(options?.authError),
  });
  const accountRouter = new AccountHono({
    requestHandlers: new AccountHandlers(options?.accountError),
  });
  const specimenRouter = new SpecimenHono({
    requestHandlers: new SpecimenHandlers(options?.specimenError),
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
