import { defineResponse, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import { defaultResponseHeader } from "../../shared/index.js";

export const SubTodoNotFoundErrorDefinition = defineResponse({
  name: "SubTodoNotFoundError",
  description: "SubTodo not found",
  statusCode: HttpStatusCode.NOT_FOUND,
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("SubTodo not found"),
    code: z.literal("SUBTODO_NOT_FOUND_ERROR"),
    context: z.object({
      todoId: z.ulid(),
    }),
    actualValues: z.object({
      subtodoId: z.ulid(),
    }),
  }),
});
