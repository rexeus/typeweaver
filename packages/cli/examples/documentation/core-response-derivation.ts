import {
  defineDerivedResponse,
  defineResponse,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";

export const NotFoundError = defineResponse({
  name: "NotFoundError",
  statusCode: HttpStatusCode.NOT_FOUND,
  description: "Resource not found",
  body: z.object({
    message: z.string(),
    code: z.literal("NOT_FOUND"),
  }),
});

export const TodoNotFoundError = defineDerivedResponse(NotFoundError, {
  name: "TodoNotFoundError",
  description: "Todo not found",
  body: z.object({
    message: z.literal("Todo not found"),
    actualValues: z.object({ todoId: z.string() }),
  }),
});
