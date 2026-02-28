import { HttpMethod, HttpOperationDefinition, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import {
  defaultRequestHeadersWithPayload,
  defaultResponseHeader,
  sharedResponses,
} from "../../shared";
import TodoNotChangeableErrorDefinition from "../errors/TodoNotChangeableErrorDefinition";
import TodoNotFoundErrorDefinition from "../errors/TodoNotFoundErrorDefinition";
import { todoSchema } from "../todoSchema";

export default new HttpOperationDefinition({
  operationId: "PutTodo",
  path: "/todos/:todoId",
  request: {
    param: z.object({
      todoId: z.ulid(),
    }),
    body: todoSchema.omit({
      id: true,
      createdBy: true,
      createdAt: true,
      modifiedBy: true,
      modifiedAt: true,
    }),
    header: defaultRequestHeadersWithPayload,
  },
  method: HttpMethod.PUT,
  summary: "Replace todo completely",
  responses: [
    {
      name: "PutTodoSuccess",
      body: todoSchema,
      description: "Todo replaced successfully",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    },
    TodoNotFoundErrorDefinition,
    TodoNotChangeableErrorDefinition,
    ...sharedResponses,
  ],
});
