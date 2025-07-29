import { ConflictErrorDefinition } from "../../shared";
import { todoStatus } from "../todoSchema";
import { z } from "zod/v4";

export default ConflictErrorDefinition.extend({
  name: "SubTodoNotChangeableError",
  description:
    "SubTodo in current status or because of parent todo status cannot be changed",
  body: z.object({
    message: z.literal(
      "SubTodo in current status or because of parent todo status cannot be changed"
    ),
    code: z.literal("SUBTODO_NOT_CHANGEABLE_ERROR"),
    context: z.object({
      todoId: z.ulid(),
      subtodoId: z.ulid(),
      currentTodoStatus: todoStatus,
      currentSubtodoStatus: todoStatus,
    }),
    expectedValues: z.object({
      allowedTodoStatuses: z.array(todoStatus),
      allowedSubtodoStatuses: z.array(todoStatus),
    }),
  }),
});
