import { defineResponse, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import { defaultResponseHeader } from "../../shared";
import { todoStatus } from "../todoSchema";

export default defineResponse({
  name: "SubTodoStatusTransitionInvalidError",
  description:
    "SubTodo status transition is conflicting with its status or parent todo status",
  statusCode: HttpStatusCode.CONFLICT,
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal(
      "SubTodo status transition is conflicting with its status or parent todo status"
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
