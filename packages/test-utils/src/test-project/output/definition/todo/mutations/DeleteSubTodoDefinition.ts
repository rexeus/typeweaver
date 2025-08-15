import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import {
  defaultRequestHeadersWithoutPayload,
  defaultResponseHeader,
  sharedResponses,
} from "../../shared";
import SubTodoNotFoundErrorDefinition from "../errors/SubTodoNotFoundErrorDefinition";
import TodoNotFoundErrorDefinition from "../errors/TodoNotFoundErrorDefinition";
import { z } from "zod/v4";

export default new HttpOperationDefinition({
  operationId: "DeleteSubTodo",
  summary: "Delete subtodo",
  method: HttpMethod.DELETE,
  path: "/todos/:todoId/subtodos/:subtodoId",
  request: {
    param: z.object({
      todoId: z.ulid(),
      subtodoId: z.ulid(),
    }),
    header: defaultRequestHeadersWithoutPayload,
  },
  responses: [
    {
      name: "DeleteSubTodoSuccess",
      body: z.object({
        message: z.string(),
      }),
      description: "SubTodo deleted successfully",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    },
    SubTodoNotFoundErrorDefinition,
    TodoNotFoundErrorDefinition,
    ...sharedResponses,
  ],
});
