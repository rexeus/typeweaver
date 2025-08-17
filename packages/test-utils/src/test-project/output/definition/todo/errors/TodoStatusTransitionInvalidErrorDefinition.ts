import { z } from "zod/v4";
import { ConflictErrorDefinition } from "../../shared";
import { todoStatus } from "../todoSchema";

export default ConflictErrorDefinition.extend({
  name: "TodoStatusTransitionInvalidError",
  description: "Todo status transition is conflicting with current status",
  body: z.object({
    message: z.literal(
      "Todo status transition is conflicting with current status",
    ),
    code: z.literal("TODO_STATUS_TRANSITION_INVALID_ERROR"),
    context: z.object({
      todoId: z.ulid(),
      currentStatus: todoStatus,
    }),
    actualValues: z.object({
      requestedStatus: todoStatus,
    }),
    expectedValues: z.object({
      allowedStatuses: z.array(todoStatus),
    }),
  }),
});
