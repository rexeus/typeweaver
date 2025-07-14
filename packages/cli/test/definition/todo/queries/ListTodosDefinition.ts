import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { listResponseSchema } from "../../shared/schemas/listResponseSchema";
import { todoSchema } from "../todoSchema";
import { sharedResponses } from "../../shared/sharedResponses";
import { defaultResponseHeader } from "../../shared/defaultResponseHeader";
import { defaultRequestHeadersWithoutPayload } from "../../shared/defaultRequestHeader";

export default new HttpOperationDefinition({
  operationId: "ListTodos",
  summary: "List todos",
  method: HttpMethod.GET,
  path: "/todos",
  request: {
    header: defaultRequestHeadersWithoutPayload,
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
