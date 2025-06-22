import { z } from "zod/v4";
import ConflictErrorDefinition from "./ConflictErrorDefinition";
import { projectSchema } from "../project/projectSchema";

export default ConflictErrorDefinition.extend({
  name: "ProjectStatusTransitionError",
  description:
    "Project status transition is conflicted with the current status",
  body: z.object({
    message: z.literal(
      "Project status transition is conflicted with the current status"
    ),
    code: z.literal("PROJECT_STATUS_TRANSITION_ERROR"),
    actualValues: z.object({
      currentStatus: projectSchema.shape.status,
    }),
    expectedValues: z.object({
      allowedStatuses: z.array(projectSchema.shape.status),
    }),
  }),
});
