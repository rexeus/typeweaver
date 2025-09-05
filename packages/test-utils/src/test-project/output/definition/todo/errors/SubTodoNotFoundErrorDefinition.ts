import { z } from "zod";
import { NotFoundErrorDefinition } from "../../shared";

export default NotFoundErrorDefinition.extend({
  name: "SubTodoNotFoundError",
  description: "SubTodo not found",
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
