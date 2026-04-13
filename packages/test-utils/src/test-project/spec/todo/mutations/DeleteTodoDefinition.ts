import {
  defineOperation,
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import {
  defaultRequestHeadersWithoutPayload,
  defaultResponseHeader,
  sharedResponses,
} from "../../shared/index.js";
import { TodoNotFoundErrorDefinition } from "../errors/TodoNotFoundErrorDefinition.js";

export const DeleteTodoDefinition = defineOperation({
  operationId: "DeleteTodo",
  summary: "Delete todo",
  method: HttpMethod.DELETE,
  path: "/todos/:todoId",
  request: {
    param: z.object({
      todoId: z.ulid(),
    }),
    header: defaultRequestHeadersWithoutPayload,
  },
  responses: [
    defineResponse({
      name: "DeleteTodoSuccess",
      description: "Todo deleted successfully",
      statusCode: HttpStatusCode.NO_CONTENT,
      header: defaultResponseHeader,
    }),
    TodoNotFoundErrorDefinition,
    ...sharedResponses,
  ],
});
