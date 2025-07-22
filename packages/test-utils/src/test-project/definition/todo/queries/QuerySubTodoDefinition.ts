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
import { defaultRequestHeadersWithPayload } from "../../shared/defaultRequestHeader";
import { listResponseSchema } from "../../shared";

const querySubTodoRequestBodySchema = z.object({
  searchText: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  dateRange: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional(),
  tags: z.array(z.string()).optional(),
});

const querySubTodoRequestQuerySchema = z.object({
  limit: z.string().optional(),
  nextToken: z.string().optional(),
  sortBy: z
    .enum(["title", "dueDate", "priority", "createdAt", "modifiedAt"])
    .optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  format: z.enum(["summary", "detailed"]).optional(),
});

export default new HttpOperationDefinition({
  operationId: "QuerySubTodo",
  request: {
    param: z.object({
      todoId: z.ulid(),
    }),
    header: defaultRequestHeadersWithPayload,
    query: querySubTodoRequestQuerySchema,
    body: querySubTodoRequestBodySchema,
  },
  method: HttpMethod.POST,
  summary: "Query subtodos for a specific todo",
  path: "/todos/:todoId/subtodos/query",
  responses: [
    {
      name: "QuerySubTodoSuccess",
      body: listResponseSchema(todoSchema),
      description: "Subtodos query results",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    },
    TodoNotFoundErrorDefinition,
    ...sharedResponses,
  ],
});
