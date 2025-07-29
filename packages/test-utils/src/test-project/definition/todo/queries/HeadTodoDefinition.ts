import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { sharedResponses } from "../../shared/sharedResponses";
import TodoNotFoundErrorDefinition from "../errors/TodoNotFoundErrorDefinition";
import { z } from "zod/v4";
import { defaultResponseHeader } from "../../shared/defaultResponseHeader";
import { defaultRequestHeadersWithoutPayload } from "../../shared/defaultRequestHeader";

export default new HttpOperationDefinition({
  operationId: "HeadTodo",
  request: {
    param: z.object({
      todoId: z.ulid(),
    }),
    header: defaultRequestHeadersWithoutPayload,
  },
  method: HttpMethod.HEAD,
  summary: "Check if todo exists",
  path: "/todos/:todoId",
  responses: [
    {
      name: "HeadTodoSuccess",
      description: "Todo exists",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    },
    TodoNotFoundErrorDefinition,
    ...sharedResponses,
  ],
});
