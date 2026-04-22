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
    // Header-only inline response (existing coverage)
    defineResponse({
      name: "DeleteTodoSuccess",
      description: "Todo deleted successfully",
      statusCode: HttpStatusCode.NO_CONTENT,
      header: defaultResponseHeader,
    }),
    // Body-only inline response (new coverage)
    defineResponse({
      name: "DeleteTodoBodyOnly",
      description: "Success with body only",
      statusCode: HttpStatusCode.OK,
      body: z.object({
        message: z.string(),
      }),
    }),
    // Neither header nor body inline response (new coverage)
    defineResponse({
      name: "DeleteTodoNoContent",
      description: "No content response",
      statusCode: HttpStatusCode.NO_CONTENT,
    }),
    TodoNotFoundErrorDefinition,
    ...sharedResponses,
  ],
});
