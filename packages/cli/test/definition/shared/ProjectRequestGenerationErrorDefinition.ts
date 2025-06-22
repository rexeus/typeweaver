import { z } from "zod/v4";
import ConflictErrorDefinition from "./ConflictErrorDefinition";
import { projectSchema } from "../project/projectSchema";

export default ConflictErrorDefinition.extend({
  name: "ProjectRequestGenerationError",
  description:
    "Requesting project generation is conflicted with the current state",
  body: z.object({
    message: z.literal(
      "Requesting project generation is conflicted with the current state"
    ),
    code: z.literal("PROJECT_REQUEST_GENERATION_ERROR"),
    actualValues: z.object({
      currentStatus: projectSchema.shape.status,
      // TODO: specify typings for completionErrors
      completionErrors: z.array(z.any()).optional(),
    }),
    expectedValues: z.object({
      requiredStatuses: z.tuple([z.literal("DRAFT"), z.literal("WITHDRAWN")]),
    }),
  }),
});
