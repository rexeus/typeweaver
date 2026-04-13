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
import { todoSchema } from "../todoSchema.js";

export const GetTodoDefinition = defineOperation({
  operationId: "GetTodo",
  request: {
    param: z.object({
      todoId: z.ulid(),
    }),
    header: defaultRequestHeadersWithoutPayload,
  },
  method: HttpMethod.GET,
  summary: "Get todo",
  path: "/todos/:todoId",
  responses: [
    defineResponse({
      name: "GetTodoSuccess",
      body: todoSchema,
      description: "Todo retrieved successfully",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    }),
    TodoNotFoundErrorDefinition,
    ...sharedResponses,
  ],
});
