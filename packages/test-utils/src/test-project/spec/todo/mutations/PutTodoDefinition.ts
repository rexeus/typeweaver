import {
  defineOperation,
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import {
  defaultRequestHeadersWithPayload,
  defaultResponseHeader,
  sharedResponses,
} from "../../shared/index.js";
import { TodoNotChangeableErrorDefinition } from "../errors/TodoNotChangeableErrorDefinition.js";
import { TodoNotFoundErrorDefinition } from "../errors/TodoNotFoundErrorDefinition.js";
import { todoSchema } from "../todoSchema.js";

export const PutTodoDefinition = defineOperation({
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
    defineResponse({
      name: "PutTodoSuccess",
      body: todoSchema,
      description: "Todo replaced successfully",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    }),
    TodoNotFoundErrorDefinition,
    TodoNotChangeableErrorDefinition,
    ...sharedResponses,
  ],
});
