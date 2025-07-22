import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { todoSchema } from "../todoSchema";
import { sharedResponses } from "../../shared/sharedResponses";
import TodoNotFoundErrorDefinition from "../errors/TodoNotFoundErrorDefinition";
import SubTodoNotFoundErrorDefinition from "../errors/SubTodoNotFoundErrorDefinition";
import SubTodoNotChangeableErrorDefinition from "../errors/SubTodoNotChangeableErrorDefinition";
import SubTodoStatusTransitionInvalidErrorDefinition from "../errors/SubTodoStatusTransitionInvalidErrorDefinition";
import { z } from "zod/v4";
import { defaultResponseHeader } from "../../shared/defaultResponseHeader";
import { defaultRequestHeadersWithPayload } from "../../shared/defaultRequestHeader";

export default new HttpOperationDefinition({
  operationId: "UpdateSubTodo",
  summary: "Update subtodo",
  method: HttpMethod.PUT,
  path: "/todos/:todoId/subtodos/:subtodoId",
  request: {
    param: z.object({
      todoId: z.ulid(),
      subtodoId: z.ulid(),
    }),
    body: todoSchema
      .omit({
        id: true,
        accountId: true,
        parentId: true,
        createdAt: true,
        createdBy: true,
        modifiedBy: true,
        modifiedAt: true,
      })
      .partial(),
    header: defaultRequestHeadersWithPayload,
  },
  responses: [
    {
      name: "UpdateSubTodoSuccess",
      body: todoSchema,
      description: "SubTodo updated successfully",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    },
    SubTodoNotFoundErrorDefinition,
    SubTodoNotChangeableErrorDefinition,
    SubTodoStatusTransitionInvalidErrorDefinition,
    TodoNotFoundErrorDefinition,
    ...sharedResponses,
  ],
});
