import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod/v4";
import { todoSchema } from "./todoSchema";
import { sharedResponses } from "../shared/sharedResponses";
import TodoNotFoundErrorDefinition from "../shared/TodoNotFoundErrorDefinition";
import { defaultResponseHeader } from "../shared/defaultResponseHeader";
import { defaultRequestHeadersWithPayload } from "../shared/defaultRequestHeader";
import TodoNotChangeableErrorDefinition from "../shared/TodoNotChangeableErrorDefinition";

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
