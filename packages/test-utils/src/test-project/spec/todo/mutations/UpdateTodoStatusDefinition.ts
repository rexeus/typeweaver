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
} from "../../shared";
import { TodoNotChangeableErrorDefinition } from "../errors/TodoNotChangeableErrorDefinition";
import { TodoNotFoundErrorDefinition } from "../errors/TodoNotFoundErrorDefinition";
import { TodoStatusTransitionInvalidErrorDefinition } from "../errors/TodoStatusTransitionInvalidErrorDefinition";
import { todoSchema } from "../todoSchema";

export const UpdateTodoStatusDefinition = defineOperation({
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
    defineResponse({
      name: "UpdateTodoStatusSuccess",
      body: todoSchema,
      description: "Todo status updated successfully",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    }),
    TodoNotFoundErrorDefinition,
    TodoStatusTransitionInvalidErrorDefinition,
    TodoNotChangeableErrorDefinition,
    ...sharedResponses,
  ],
});
