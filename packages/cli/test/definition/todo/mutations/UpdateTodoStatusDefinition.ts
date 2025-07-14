import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { todoSchema } from "../todoSchema";
import { z } from "zod/v4";
import { defaultResponseHeader } from "../../shared/defaultResponseHeader";
import { sharedResponses } from "../../shared/sharedResponses";
import TodoNotFoundErrorDefinition from "../errors/TodoNotFoundErrorDefinition";
import TodoStatusTransitionInvalidErrorDefinition from "../errors/TodoStatusTransitionInvalidErrorDefinition";
import { defaultRequestHeadersWithPayload } from "../../shared/defaultRequestHeader";
import TodoNotChangeableErrorDefinition from "../errors/TodoNotChangeableErrorDefinition";

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
