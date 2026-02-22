import { HttpResponse } from "@rexeus/typeweaver-core";
import type { IHttpResponse } from "@rexeus/typeweaver-core";
import {
  TypeweaverApp,
  type TypeweaverRouterOptions,
} from "../test-project/output/lib/server";
import { TodoRouter } from "../test-project/output/todo/TodoRouter";
import { AccountRouter } from "../test-project/output/account/AccountRouter";
import { AuthRouter } from "../test-project/output/auth/AuthRouter";
import { ServerTodoHandlers } from "./handlers/ServerTodoHandlers";
import { ServerAccountHandlers } from "./handlers/ServerAccountHandlers";
import { ServerAuthHandlers } from "./handlers/ServerAuthHandlers";

export type TestAppOptions = {
  readonly throwTodoError?: Error | HttpResponse;
  readonly throwAuthError?: Error | HttpResponse;
  readonly throwAccountError?: Error | HttpResponse;
  readonly customResponses?: HttpResponse | IHttpResponse;
} & Omit<TypeweaverRouterOptions<unknown>, "requestHandlers">;

export function createTestApp(options?: TestAppOptions): TypeweaverApp {
  const app = new TypeweaverApp();

  if (options?.customResponses) {
    app.use(async (_ctx, _next) => {
      return options.customResponses!;
    });
  }

  const todoRouter = new TodoRouter({
    requestHandlers: new ServerTodoHandlers(options?.throwTodoError),
    validateRequests: options?.validateRequests,
    handleHttpResponseErrors: options?.handleHttpResponseErrors,
    handleValidationErrors: options?.handleValidationErrors,
    handleUnknownErrors: options?.handleUnknownErrors,
  });
  const authRouter = new AuthRouter({
    requestHandlers: new ServerAuthHandlers(options?.throwAuthError),
    validateRequests: options?.validateRequests,
    handleHttpResponseErrors: options?.handleHttpResponseErrors,
    handleValidationErrors: options?.handleValidationErrors,
    handleUnknownErrors: options?.handleUnknownErrors,
  });
  const accountRouter = new AccountRouter({
    requestHandlers: new ServerAccountHandlers(options?.throwAccountError),
    validateRequests: options?.validateRequests,
    handleHttpResponseErrors: options?.handleHttpResponseErrors,
    handleValidationErrors: options?.handleValidationErrors,
    handleUnknownErrors: options?.handleUnknownErrors,
  });

  app.route(authRouter);
  app.route(accountRouter);
  app.route(todoRouter);

  return app;
}
