import { Hono } from "hono";
import { TodoHono, AuthHono, AccountHono, SpecimenHono } from "..";
import { TodoHandlers } from "./handlers/TodoHandlers";
import { AuthHandlers } from "./handlers/AuthHandlers";
import { AccountHandlers } from "./handlers/AccountApiHandler";
import { SpecimenHandlers } from "./handlers/SpecimenHandlers";
import { serve, type ServerType } from "@hono/node-server";
import { HttpResponse } from "@rexeus/typeweaver-core";
import getPort, { portNumbers } from "get-port";

export type CreateTestServerResult = {
  readonly server: ServerType;
  readonly baseUrl: string;
};

export async function createTestServer(handlerOptions?: {
  readonly todoError?: Error | HttpResponse;
  readonly authError?: Error | HttpResponse;
  readonly accountError?: Error | HttpResponse;
  readonly specimenError?: Error | HttpResponse;
}): Promise<CreateTestServerResult> {
  const app = new Hono();

  const todoRouter = new TodoHono(new TodoHandlers(handlerOptions?.todoError));
  const authRouter = new AuthHono(new AuthHandlers(handlerOptions?.authError));
  const accountRouter = new AccountHono(
    new AccountHandlers(handlerOptions?.accountError)
  );
  const specimenRouter = new SpecimenHono(
    new SpecimenHandlers(handlerOptions?.specimenError)
  );

  app.route("/", authRouter);
  app.route("/", accountRouter);
  app.route("/", todoRouter);
  app.route("/", specimenRouter);

  const port = await getPort({ port: portNumbers(3000, 3100) });

  const server = serve({
    fetch: app.fetch,
    port,
  });

  return {
    server,
    baseUrl: `http://localhost:${port}`,
  };
}
