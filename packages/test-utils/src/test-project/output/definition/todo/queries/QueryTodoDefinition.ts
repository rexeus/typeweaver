import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import {
  listResponseSchema,
  sharedResponses,
  defaultResponseHeader,
  defaultRequestHeadersWithPayload,
} from "../../shared";
import { todoSchema } from "../todoSchema";
import { z } from "zod/v4";

const queryTodoRequestBodySchema = z.object({
  searchText: z.string().optional(),
  accountId: z.ulid().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  dateRange: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional(),
  tags: z.array(z.string()).optional(),
  hasParent: z.boolean().optional(),
});

const queryTodoRequestQuerySchema = z.object({
  limit: z.string().optional(),
  nextToken: z.string().optional(),
  sortBy: z
    .enum(["title", "dueDate", "priority", "createdAt", "modifiedAt"])
    .optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export default new HttpOperationDefinition({
  operationId: "QueryTodo",
  request: {
    header: defaultRequestHeadersWithPayload,
    query: queryTodoRequestQuerySchema,
    body: queryTodoRequestBodySchema,
  },
  method: HttpMethod.POST,
  summary: "Query todos with advanced search criteria",
  path: "/todos/query",
  responses: [
    {
      name: "QueryTodoSuccess",
      body: listResponseSchema(todoSchema),
      description: "Todos query results",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    },
    ...sharedResponses,
  ],
});
