import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod/v4";
import { sharedResponses } from "../shared/sharedResponses";
import TodoNotFoundErrorDefinition from "./TodoNotFoundErrorDefinition";
import { defaultResponseHeader } from "../shared/defaultResponseHeader";
import { defaultRequestHeadersWithoutPayload } from "../shared/defaultRequestHeader";

export default new HttpOperationDefinition({
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
    {
      name: "DeleteTodoSuccess",
      description: "Todo deleted successfully",
      statusCode: HttpStatusCode.NO_CONTENT,
      header: defaultResponseHeader,
    },
    TodoNotFoundErrorDefinition,
    ...sharedResponses,
  ],
});