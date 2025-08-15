import { ConflictErrorDefinition } from "../../shared";
import { todoStatus } from "../todoSchema";
import { z } from "zod/v4";

export default ConflictErrorDefinition.extend({
  name: "SubTodoStatusTransitionInvalidError",
  description:
    "SubTodo status transition is conflicting with its status or parent todo status",
  body: z.object({
    message: z.literal(
      "SubTodo status transition is conflicting with its status or parent todo status",
    ),
    code: z.literal("SUBTODO_STATUS_TRANSITION_INVALID_ERROR"),
    context: z.object({
      todoId: z.ulid(),
      subtodoId: z.ulid(),
      currentTodoStatus: todoStatus,
      currentSubtodoStatus: todoStatus,
    }),
    actualValues: z.object({
      requestedSubtodoStatus: todoStatus,
    }),
    expectedValues: z.object({
      allowedSubtodoStatuses: z.array(todoStatus),
    }),
  }),
});
