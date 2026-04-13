import {
  defineOperation,
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import { defaultRequestHeadersWithoutPayload } from "../../shared/defaultRequestHeader.js";
import { defaultResponseHeader } from "../../shared/defaultResponseHeader.js";
import { sharedResponses } from "../../shared/sharedResponses.js";
import { TodoNotFoundErrorDefinition } from "../errors/TodoNotFoundErrorDefinition.js";

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
