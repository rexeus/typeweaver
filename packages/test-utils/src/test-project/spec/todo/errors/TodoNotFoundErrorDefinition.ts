import { defineResponse, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import { defaultResponseHeader } from "../../shared";

export const TodoNotFoundErrorDefinition = defineResponse({
  name: "TodoNotFoundError",
  description: "Todo not found",
  statusCode: HttpStatusCode.NOT_FOUND,
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("Todo not found"),
    code: z.literal("TODO_NOT_FOUND_ERROR"),
    actualValues: z.object({
      todoId: z.ulid(),
    }),
  }),
});
