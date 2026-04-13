import {
  defineOperation,
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import {
  defaultRequestHeadersWithPayload,
  defaultResponseHeader,
  sharedResponses,
} from "../../shared/index.js";
import { SubTodoNotChangeableErrorDefinition } from "../errors/SubTodoNotChangeableErrorDefinition.js";
import { SubTodoNotFoundErrorDefinition } from "../errors/SubTodoNotFoundErrorDefinition.js";
import { SubTodoStatusTransitionInvalidErrorDefinition } from "../errors/SubTodoStatusTransitionInvalidErrorDefinition.js";
import { TodoNotFoundErrorDefinition } from "../errors/TodoNotFoundErrorDefinition.js";
import { todoSchema } from "../todoSchema.js";

export const UpdateSubTodoDefinition = defineOperation({
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
    defineResponse({
      name: "UpdateSubTodoSuccess",
      body: todoSchema,
      description: "SubTodo updated successfully",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    }),
    SubTodoNotFoundErrorDefinition,
    SubTodoNotChangeableErrorDefinition,
    SubTodoStatusTransitionInvalidErrorDefinition,
    TodoNotFoundErrorDefinition,
    ...sharedResponses,
  ],
});
