import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod/v4";
import { defaultRequestHeadersWithoutPayload } from "../../shared/defaultRequestHeader";
import { sharedResponses } from "../../shared/sharedResponses";
import TodoNotFoundErrorDefinition from "../errors/TodoNotFoundErrorDefinition";

export default new HttpOperationDefinition({
  operationId: "OptionsTodo",
  request: {
    param: z.object({
      todoId: z.ulid(),
    }),
    header: z.object({
      ...defaultRequestHeadersWithoutPayload.shape,
      "Access-Control-Request-Method": z.string().optional(),
      "Access-Control-Request-Headers": z.array(z.string()).optional(),
    }),
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
        Allow: z.array(z.string()),
        "Access-Control-Allow-Origin": z.string().optional(),
        "Access-Control-Allow-Methods": z.array(z.string()).optional(),
        "Access-Control-Allow-Headers": z.array(z.string()).optional(),
        "Access-Control-Max-Age": z.string().optional(),
      }),
    },
    TodoNotFoundErrorDefinition,
    ...sharedResponses,
  ],
});
