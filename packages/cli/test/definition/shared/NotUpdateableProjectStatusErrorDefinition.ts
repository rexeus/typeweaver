import { z } from "zod/v4";
import ConflictErrorDefinition from "./ConflictErrorDefinition";
import { projectSchema } from "../project/projectSchema";

export default ConflictErrorDefinition.extend({
  name: "NotUpdateableProjectStatusError",
  description: "Updating project is conflicted with current status",
  body: z.object({
    message: z.literal("Updating project is conflicted with current status"),
    code: z.literal("NOT_UPDATEABLE_PROJECT_STATUS_ERROR"),
    actualValues: z.object({
      currentStatus: projectSchema.shape.status,
    }),
    expectedValues: z.object({
      requiredStatuses: z.tuple([
        z.literal("INITIAL"),
        z.literal("DRAFT"),
        z.literal("IN_REVIEW"),
        z.literal("WITHDRAWN"),
      ]),
    }),
  }),
});
