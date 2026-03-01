import { HttpMethod, HttpOperationDefinition, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import {
  defaultRequestHeadersWithoutPayload,
  defaultResponseHeader,
  listResponseSchema,
  sharedResponses,
} from "../../shared";
import { todoSchema } from "../todoSchema";
const listTodosQuerySchema = z.object({
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.string().optional(),
  nextToken: z.string().optional(),
  sortBy: z.enum(["title", "dueDate", "priority", "createdAt", "modifiedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});
export default new HttpOperationDefinition({
  operationId: "ListTodos",
  summary: "List todos with filtering, pagination, and search",
  method: HttpMethod.GET,
  path: "/todos",
  request: {
    header: defaultRequestHeadersWithoutPayload,
    query: listTodosQuerySchema,
  },
  responses: [
    {
      name: "ListTodosSuccess",
      description: "List todos successfully",
      statusCode: HttpStatusCode.OK,
      body: listResponseSchema(todoSchema),
      header: defaultResponseHeader,
    },
    ...sharedResponses,
  ],
});
