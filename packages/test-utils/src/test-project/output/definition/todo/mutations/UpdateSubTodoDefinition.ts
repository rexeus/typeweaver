import { HttpMethod, HttpOperationDefinition, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import {
  defaultRequestHeadersWithPayload,
  defaultResponseHeader,
  sharedResponses,
} from "../../shared";
import SubTodoNotChangeableErrorDefinition from "../errors/SubTodoNotChangeableErrorDefinition";
import SubTodoNotFoundErrorDefinition from "../errors/SubTodoNotFoundErrorDefinition";
import SubTodoStatusTransitionInvalidErrorDefinition from "../errors/SubTodoStatusTransitionInvalidErrorDefinition";
import TodoNotFoundErrorDefinition from "../errors/TodoNotFoundErrorDefinition";
import { todoSchema } from "../todoSchema";

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
