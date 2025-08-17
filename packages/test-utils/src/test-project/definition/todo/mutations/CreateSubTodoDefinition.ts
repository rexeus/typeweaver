import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod/v4";
import {
  defaultRequestHeadersWithPayload,
  defaultResponseHeader,
  sharedResponses,
} from "../../shared";
import TodoNotFoundErrorDefinition from "../errors/TodoNotFoundErrorDefinition";
import { todoSchema } from "../todoSchema";

export default new HttpOperationDefinition({
  operationId: "CreateSubTodo",
  summary: "Create new subtodo",
  method: HttpMethod.POST,
  path: "/todos/:todoId/subtodos",
  request: {
    param: z.object({
      todoId: z.ulid(),
    }),
    body: todoSchema.omit({
      id: true,
      accountId: true,
      parentId: true,
      createdAt: true,
      createdBy: true,
      modifiedBy: true,
      modifiedAt: true,
      status: true,
    }),
    header: defaultRequestHeadersWithPayload,
  },
  responses: [
    {
      name: "CreateSubTodoSuccess",
      body: todoSchema,
      description: "SubTodo created successfully",
      statusCode: HttpStatusCode.CREATED,
      header: defaultResponseHeader,
    },
    TodoNotFoundErrorDefinition,
    ...sharedResponses,
  ],
});
