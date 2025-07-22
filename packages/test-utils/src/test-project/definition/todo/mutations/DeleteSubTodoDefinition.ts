import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { sharedResponses } from "../../shared/sharedResponses";
import TodoNotFoundErrorDefinition from "../errors/TodoNotFoundErrorDefinition";
import SubTodoNotFoundErrorDefinition from "../errors/SubTodoNotFoundErrorDefinition";
import { z } from "zod/v4";
import { defaultResponseHeader } from "../../shared/defaultResponseHeader";
import { defaultRequestHeadersWithoutPayload } from "../../shared/defaultRequestHeader";

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
