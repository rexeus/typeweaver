import type { IRawHttpRequest } from "@rexeus/typeweaver-core";
import { HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import { createCreateTodoSuccessResponse } from "../../../test-utils/src/test-project/output/responses/CreateTodoSuccessResponse.js";
import { GetTodoRequestValidator } from "../../../test-utils/src/test-project/output/todo/GetTodoRequestValidator.js";
import { GetTodoResponseValidator } from "../../../test-utils/src/test-project/output/todo/GetTodoResponseValidator.js";
import type { CreateTodoResponse } from "../../../test-utils/src/test-project/output/todo/CreateTodoResponse.js";

export const createResponse = (): CreateTodoResponse =>
  createCreateTodoSuccessResponse({
    header: { "Content-Type": "application/json" },
    body: {
      id: "0d5c2f5b-8e1a-4b7c-9f2e-1a2b3c4d5e6f",
      accountId: "account-1",
      title: "Write documentation",
      status: "TODO",
      createdAt: "2026-07-26",
      modifiedAt: "2026-07-26",
      createdBy: "docs",
      modifiedBy: "docs",
    },
  });

export const request: IRawHttpRequest = {
  method: HttpMethod.GET,
  path: "/todos/846a8c8d-28dc-4b66-ae6c-8d1c551430b2",
  header: {
    Accept: "application/json",
    Authorization: "Bearer example-token",
  },
  param: {
    todoId: "846a8c8d-28dc-4b66-ae6c-8d1c551430b2",
  },
};

export const validateRequest = () => {
  const result = new GetTodoRequestValidator().safeValidate(request);
  if (result.isValid) {
    return result.data.param.todoId;
  }
  return result.error;
};

export const validateResponse = () =>
  new GetTodoResponseValidator().safeValidate({
    statusCode: HttpStatusCode.OK,
    body: {
      id: "846a8c8d-28dc-4b66-ae6c-8d1c551430b2",
      accountId: "account-1",
      title: "Write documentation",
      status: "TODO",
      createdAt: "2026-07-26",
      modifiedAt: "2026-07-26",
      createdBy: "docs",
      modifiedBy: "docs",
    },
  });
