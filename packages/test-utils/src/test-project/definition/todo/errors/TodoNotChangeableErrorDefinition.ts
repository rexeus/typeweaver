import { ConflictErrorDefinition } from "../../shared";
import { todoStatus } from "../todoSchema";
import { z } from "zod/v4";

export default ConflictErrorDefinition.extend({
  name: "TodoNotChangeableError",
  description: "Todo in current status cannot be changed",
  body: z.object({
    message: z.literal("Todo in current status cannot be changed"),
    code: z.literal("TODO_NOT_CHANGEABLE_ERROR"),
    context: z.object({
      todoId: z.ulid(),
      currentStatus: todoStatus,
    }),
    expectedValues: z.object({
      allowedStatuses: z.array(todoStatus),
    }),
  }),
});
