import { Hono } from "hono";
import { TodoHono, AuthHono, AccountHono, VariationHono } from "..";
import { TodoHandlers } from "./handlers/TodoHandlers";
import { AuthHandlers } from "./handlers/AuthHandlers";
import { AccountHandlers } from "./handlers/AccountApiHandler";
import { VariationHandlers } from "./handlers/VariationHandlers";
import { serve, type ServerType } from "@hono/node-server";

export async function createTestServer(port: number): Promise<ServerType> {
  const app = new Hono();

  const todoRouter = new TodoHono(new TodoHandlers());
  const authRouter = new AuthHono(new AuthHandlers());
  const accountRouter = new AccountHono(new AccountHandlers());
  const variationRouter = new VariationHono(new VariationHandlers());

  app.route("/", authRouter);
  app.route("/", accountRouter);
  app.route("/", todoRouter);
  app.route("/", variationRouter);

  return serve({
    fetch: app.fetch,
    port,
  });
}
