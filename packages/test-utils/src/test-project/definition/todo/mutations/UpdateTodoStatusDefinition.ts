import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import {
  defaultRequestHeadersWithPayload,
  defaultResponseHeader,
  sharedResponses,
} from "../../shared";
import { todoSchema } from "../todoSchema";
import TodoNotChangeableErrorDefinition from "../errors/TodoNotChangeableErrorDefinition";
import TodoNotFoundErrorDefinition from "../errors/TodoNotFoundErrorDefinition";
import TodoStatusTransitionInvalidErrorDefinition from "../errors/TodoStatusTransitionInvalidErrorDefinition";
import { z } from "zod/v4";

export default new HttpOperationDefinition({
  operationId: "UpdateTodoStatus",
  path: "/todos/:todoId/status",
  method: HttpMethod.PUT,
  summary: "Update todo status",
  request: {
    param: z.object({
      todoId: z.ulid(),
    }),
    body: z.object({
      value: todoSchema.shape.status,
    }),
    header: defaultRequestHeadersWithPayload,
  },
  responses: [
    {
      name: "UpdateTodoStatusSuccess",
      body: todoSchema,
      description: "Todo status updated successfully",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    },
    TodoNotFoundErrorDefinition,
    TodoStatusTransitionInvalidErrorDefinition,
    TodoNotChangeableErrorDefinition,
    ...sharedResponses,
  ],
});
