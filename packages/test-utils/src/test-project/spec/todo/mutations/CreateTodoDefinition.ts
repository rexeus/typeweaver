import {
  defineOperation,
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import {
  defaultRequestHeadersWithPayload,
  defaultResponseHeader,
  sharedResponses,
} from "../../shared";
import { todoSchema } from "../todoSchema";

export const CreateTodoDefinition = defineOperation({
  operationId: "CreateTodo",
  summary: "Create new todo",
  method: HttpMethod.POST,
  path: "/todos",
  request: {
    body: todoSchema.omit({
      id: true,
      parentId: true,
      accountId: true,
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
      name: "CreateTodoSuccess",
      body: todoSchema,
      description: "Todo created successfully",
      statusCode: HttpStatusCode.CREATED,
      header: defaultResponseHeader,
    }),
    ...sharedResponses,
  ],
});
