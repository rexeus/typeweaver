import { Hono } from "hono";
import { TodoHono } from "../test-project/output/todo/TodoHono";
import { AuthHono } from "../test-project/output/auth/AuthHono";
import { AccountHono } from "../test-project/output/account/AccountHono";
import { TodoHandlers } from "./handlers/TodoHandlers";
import { AuthHandlers } from "./handlers/AuthHandlers";
import { AccountHandlers } from "./handlers/AccountApiHandler";
import { serve, type ServerType } from "@hono/node-server";

export async function createTestServer(port: number): Promise<ServerType> {
  const app = new Hono();

  const todoRouter = new TodoHono(new TodoHandlers());
  const authRouter = new AuthHono(new AuthHandlers());
  const accountRouter = new AccountHono(new AccountHandlers());

  app.route("/", authRouter);
  app.route("/", accountRouter);
  app.route("/", todoRouter);

  return serve({
    fetch: app.fetch,
    port,
  });
}
