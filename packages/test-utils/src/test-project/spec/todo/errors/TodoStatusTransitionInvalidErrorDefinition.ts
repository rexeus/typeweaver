import { defineResponse, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import { defaultResponseHeader } from "../../shared/index.js";
import { todoStatus } from "../todoSchema.js";

export const TodoStatusTransitionInvalidErrorDefinition = defineResponse({
  name: "TodoStatusTransitionInvalidError",
  description: "Todo status transition is conflicting with current status",
  statusCode: HttpStatusCode.CONFLICT,
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal(
      "Todo status transition is conflicting with current status"
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
