import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { todoSchema } from "../todoSchema";
import { sharedResponses } from "../../shared/sharedResponses";
import { defaultResponseHeader } from "../../shared/defaultResponseHeader";
import { defaultRequestHeadersWithPayload } from "../../shared/defaultRequestHeader";

export default new HttpOperationDefinition({
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
    {
      name: "CreateTodoSuccess",
      body: todoSchema,
      description: "Todo created successfully",
      statusCode: HttpStatusCode.CREATED,
      header: defaultResponseHeader,
    },
    ...sharedResponses,
  ],
});
