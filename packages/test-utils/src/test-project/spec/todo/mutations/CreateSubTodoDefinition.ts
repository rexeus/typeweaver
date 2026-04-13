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
import { TodoNotFoundErrorDefinition } from "../errors/TodoNotFoundErrorDefinition.js";
import { todoSchema } from "../todoSchema.js";

export const CreateSubTodoDefinition = defineOperation({
  operationId: "CreateSubTodo",
  summary: "Create new subtodo",
  method: HttpMethod.POST,
  path: "/todos/:todoId/subtodos",
  request: {
    param: z.object({
      todoId: z.ulid(),
    }),
    body: todoSchema.omit({
      id: true,
      accountId: true,
      parentId: true,
      createdAt: true,
      createdBy: true,
      modifiedBy: true,
      modifiedAt: true,
      status: true,
    }),
    header: defaultRequestHeadersWithPayload,
  },
  responses: [
    defineResponse({
      name: "CreateSubTodoSuccess",
      body: todoSchema,
      description: "SubTodo created successfully",
      statusCode: HttpStatusCode.CREATED,
      header: defaultResponseHeader,
    }),
    TodoNotFoundErrorDefinition,
    ...sharedResponses,
  ],
});
