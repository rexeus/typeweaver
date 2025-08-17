import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod/v4";
import {
  defaultRequestHeadersWithoutPayload,
  defaultResponseHeader,
  sharedResponses,
} from "../../shared";
import TodoNotFoundErrorDefinition from "../errors/TodoNotFoundErrorDefinition";
import { todoSchema } from "../todoSchema";

export default new HttpOperationDefinition({
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
    {
      name: "GetTodoSuccess",
      body: todoSchema,
      description: "Todo retrieved successfully",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    },
    TodoNotFoundErrorDefinition,
    ...sharedResponses,
  ],
});
