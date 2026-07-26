import { createGetTodoSuccessResponse } from "../../../test-utils/src/test-project/output/responses/GetTodoSuccessResponse.js";
import type { HonoTodoApiHandler } from "../../../test-utils/src/test-project/output/todo/TodoHono.js";

export const handleGetTodoRequest: HonoTodoApiHandler["handleGetTodoRequest"] =
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
