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
  operationId: "PutTodo",
  path: "/todos/:todoId",
  request: {
    param: z.object({
      todoId: z.ulid(),
    }),
    body: todoSchema
      .omit({
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