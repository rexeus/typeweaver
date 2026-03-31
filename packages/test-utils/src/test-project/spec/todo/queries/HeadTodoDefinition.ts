import {
  defineOperation,
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import { defaultRequestHeadersWithoutPayload } from "../../shared/defaultRequestHeader";
import { defaultResponseHeader } from "../../shared/defaultResponseHeader";
import { sharedResponses } from "../../shared/sharedResponses";
import { TodoNotFoundErrorDefinition } from "../errors/TodoNotFoundErrorDefinition";

export const HeadTodoDefinition = defineOperation({
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
    defineResponse({
      name: "HeadTodoSuccess",
      description: "Todo exists",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    }),
    TodoNotFoundErrorDefinition,
    ...sharedResponses,
  ],
});
