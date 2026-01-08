import { createServer } from "node:http";
import { HttpResponse } from "@rexeus/typeweaver-core";
import express from "express";
import getPort, { portNumbers } from "get-port";
import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { AccountExpress, AuthExpress, TodoExpress } from "../..";
import { ExpressAdapter } from "../../test-project/output/lib/express";
import { AccountHandlers } from "../handlers/AccountApiHandler";
import { AuthHandlers } from "../handlers/AuthHandlers";
import { TodoHandlers } from "../handlers/TodoHandlers";
import type { TypeweaverExpressOptions } from "../../test-project/output/lib/express";
import type { Express } from "express";
import type { Server } from "node:http";

export type TestExpressServerOptions = {
  readonly throwTodoError?: Error | HttpResponse;
  readonly throwAuthError?: Error | HttpResponse;
  readonly throwAccountError?: Error | HttpResponse;
  readonly throwSpecimenError?: Error | HttpResponse;
  readonly customResponses?: HttpResponse | IHttpResponse;
} & Omit<TypeweaverExpressOptions<unknown>, "requestHandlers">;

export type CreateTestExpressServerResult = {
  readonly server: Server;
  readonly baseUrl: string;
};

export function createTestExpress(options?: TestExpressServerOptions): Express {
  const app = express();
  const adapter = new ExpressAdapter();

  // Body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Custom response middleware
  if (options?.customResponses) {
    app.use((_req, res, next) => {
      if (options.customResponses) {
        adapter.sendResponse(options.customResponses, res);
        return;
      }
      next();
    });
  }

  const todoRouter = new TodoExpress({
    requestHandlers: new TodoHandlers(options?.throwTodoError),
    ...options,
  });
  const authRouter = new AuthExpress({
    requestHandlers: new AuthHandlers(options?.throwAuthError),
    ...options,
  });
  const accountRouter = new AccountExpress({
    requestHandlers: new AccountHandlers(options?.throwAccountError),
    ...options,
  });

  app.use("/", authRouter.router);
  app.use("/", accountRouter.router);
  app.use("/", todoRouter.router);

  return app;
}

export async function createExpressTestServer(
  options?: TestExpressServerOptions
): Promise<CreateTestExpressServerResult> {
  const port = await getPort({ port: portNumbers(3000, 3100) });

  const app = createTestExpress(options);

  const server = createServer(app);

  await new Promise<void>(resolve => {
    server.listen(port, resolve);
  });

  return {
    server,
    baseUrl: `http://localhost:${port}`,
  };
}
