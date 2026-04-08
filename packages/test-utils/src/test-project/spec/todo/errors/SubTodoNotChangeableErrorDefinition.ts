import { defineResponse, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import { defaultResponseHeader } from "../../shared/index.js";
import { todoStatus } from "../todoSchema.js";

export const SubTodoNotChangeableErrorDefinition = defineResponse({
  name: "SubTodoNotChangeableError",
  description:
    "SubTodo in current status or because of parent todo status cannot be changed",
  statusCode: HttpStatusCode.CONFLICT,
  header: defaultResponseHeader,
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
