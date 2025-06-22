import UnprocessableEntityErrorDefinition from "./UnprocessableEntityErrorDefinition";
import { z } from "zod/v4";

export default UnprocessableEntityErrorDefinition.extend({
  name: "NonExistingProjectError",
  description: "Non existing project",
  body: z.object({
    message: z.literal("Non existing project"),
    code: z.literal("NON_EXISTING_PROJECT_ERROR"),
    actualValues: z.object({
      projectId: z.ulid(),
    }),
  }),
});
