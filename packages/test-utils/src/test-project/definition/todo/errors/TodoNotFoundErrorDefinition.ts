import { NotFoundErrorDefinition } from "../../shared";
import { z } from "zod/v4";

export default NotFoundErrorDefinition.extend({
  name: "TodoNotFoundError",
  description: "Todo not found",
  body: z.object({
    message: z.literal("Todo not found"),
    code: z.literal("TODO_NOT_FOUND_ERROR"),
    actualValues: z.object({
      todoId: z.ulid(),
    }),
  }),
});
