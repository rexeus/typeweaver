import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { sharedResponses } from "../../shared/sharedResponses";
import TodoNotFoundErrorDefinition from "../errors/TodoNotFoundErrorDefinition";
import { z } from "zod/v4";
import { defaultRequestHeadersWithoutPayload } from "../../shared/defaultRequestHeader";

export default new HttpOperationDefinition({
  operationId: "OptionsTodo",
  request: {
    param: z.object({
      todoId: z.ulid(),
    }),
    header: defaultRequestHeadersWithoutPayload,
  },
  method: HttpMethod.OPTIONS,
  summary: "Get allowed methods for todo resource",
  path: "/todos/:todoId",
  responses: [
    {
      name: "OptionsTodoSuccess",
      description: "Allowed methods for todo resource",
      statusCode: HttpStatusCode.OK,
      header: z.object({
        Allow: z.string(),
        "Access-Control-Allow-Methods": z.string().optional(),
        "Access-Control-Allow-Headers": z.string().optional(),
      }),
    },
    TodoNotFoundErrorDefinition,
    ...sharedResponses,
  ],
});