import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { todoSchema } from "../todoSchema";
import { sharedResponses } from "../../shared/sharedResponses";
import TodoNotFoundErrorDefinition from "../errors/TodoNotFoundErrorDefinition";
import { z } from "zod/v4";
import { defaultResponseHeader } from "../../shared/defaultResponseHeader";
import { defaultRequestHeadersWithoutPayload } from "../../shared/defaultRequestHeader";

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
