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

export const UpdateTodoDefinition = defineOperation({
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
    defineResponse({
      name: "UpdateTodoSuccess",
      body: todoSchema,
      description: "Todo updated successfully",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    }),
    TodoNotFoundErrorDefinition,
    TodoNotChangeableErrorDefinition,
    ...sharedResponses,
  ],
});
