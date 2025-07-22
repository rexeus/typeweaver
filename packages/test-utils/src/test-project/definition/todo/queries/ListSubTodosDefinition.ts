import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { todoSchema } from "../todoSchema";
import { sharedResponses } from "../../shared/sharedResponses";
import TodoNotFoundErrorDefinition from "../errors/TodoNotFoundErrorDefinition";
import { z } from "zod/v4";
import { defaultResponseHeader } from "../../shared/defaultResponseHeader";
import { defaultRequestHeadersWithoutPayload } from "../../shared/defaultRequestHeader";
import { listResponseSchema } from "../../shared";

const listSubTodosQuerySchema = z.object({
  limit: z.string().optional(),
  nextToken: z.string().optional(),
  sortBy: z
    .enum(["title", "dueDate", "priority", "createdAt", "modifiedAt"])
    .optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export default new HttpOperationDefinition({
  operationId: "ListSubTodos",
  request: {
    param: z.object({
      todoId: z.ulid(),
    }),
    header: defaultRequestHeadersWithoutPayload,
    query: listSubTodosQuerySchema,
  },
  method: HttpMethod.GET,
  summary: "List subtodos for a specific todo",
  path: "/todos/:todoId/subtodos",
  responses: [
    {
      name: "ListSubTodosSuccess",
      body: listResponseSchema(todoSchema),
      description: "Subtodos retrieved successfully",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    },
    TodoNotFoundErrorDefinition,
    ...sharedResponses,
  ],
});
