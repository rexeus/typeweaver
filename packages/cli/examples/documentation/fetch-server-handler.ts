import { createGetTodoSuccessResponse } from "../../../test-utils/src/test-project/output/responses/GetTodoSuccessResponse.js";
import type { ServerTodoApiHandler } from "../../../test-utils/src/test-project/output/todo/TodoRouter.js";

export const handleGetTodoRequest: ServerTodoApiHandler["handleGetTodoRequest"] =
  async request =>
    createGetTodoSuccessResponse({
      header: { "Content-Type": "application/json" },
      body: {
        id: request.param.todoId,
        accountId: "account-1",
        title: "Executable documentation",
        status: "TODO",
        createdAt: "2026-07-26",
        modifiedAt: "2026-07-26",
        createdBy: "docs",
        modifiedBy: "docs",
      },
    });
