import {
  defineOperation,
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import { defaultRequestHeadersWithoutPayload } from "../../shared/defaultRequestHeader.js";
import { sharedResponses } from "../../shared/sharedResponses.js";
import { TodoNotFoundErrorDefinition } from "../errors/TodoNotFoundErrorDefinition.js";

export const OptionsTodoDefinition = defineOperation({
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
    defineResponse({
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
    }),
    TodoNotFoundErrorDefinition,
    ...sharedResponses,
  ],
});
