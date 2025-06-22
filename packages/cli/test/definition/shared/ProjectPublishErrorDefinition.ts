import { z } from "zod/v4";
import ConflictErrorDefinition from "./ConflictErrorDefinition";
import { projectSchema } from "../project/projectSchema";

export default ConflictErrorDefinition.extend({
  name: "ProjectPublishError",
  description: "Publishing project is conflicted with the current state",
  body: z.object({
    message: z.literal(
      "Publishing project is conflicted with the current state"
    ),
    code: z.literal("PROJECT_PUBLISH_ERROR"),
    actualValues: z.object({
      currentStatus: projectSchema.shape.status,
      isAdForPublishingSelected: z.boolean(),
      isFunnelForPublishingSelected: z.boolean(),
    }),
    expectedValues: z.object({
      requiredStatuses: z.tuple([
        z.literal("IN_REVIEW"),
        z.literal("WITHDRAWN"),
      ]),
      isAdForPublishingSelected: z.literal(true),
      isFunnelForPublishingSelected: z.literal(true),
    }),
  }),
});
