import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod/v4";
import {
  sharedResponses,
  defaultResponseHeader,
  defaultRequestHeadersWithPayload,
} from "../../shared";
import { todoSchema } from "../todoSchema";
import TodoNotFoundErrorDefinition from "../errors/TodoNotFoundErrorDefinition";
import TodoNotChangeableErrorDefinition from "../errors/TodoNotChangeableErrorDefinition";

export default new HttpOperationDefinition({
  operationId: "UpdateTodo",
  path: "/todos/:todoId",
  request: {
    param: z.object({
      todoId: z.ulid(),
    }),
    body: todoSchema
      .omit({
        id: true,
        parentId: true,
        createdBy: true,
        createdAt: true,
        modifiedBy: true,
        modifiedAt: true,
        accountId: true,
        status: true,
      })
      .partial(),
    header: defaultRequestHeadersWithPayload,
  },
  method: HttpMethod.PATCH,
  summary: "Update todo",
  responses: [
    {
      name: "UpdateTodoSuccess",
      body: todoSchema,
      description: "Todo updated successfully",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    },
    TodoNotFoundErrorDefinition,
    TodoNotChangeableErrorDefinition,
    ...sharedResponses,
  ],
});
