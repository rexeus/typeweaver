import NotFoundErrorDefinition from "./NotFoundErrorDefinition";
import { z } from "zod/v4";

export default NotFoundErrorDefinition.extend({
  name: "ProjectNotFoundError",
  description: "Project not found",
  body: z.object({
    message: z.literal("Project not found"),
    code: z.literal("PROJECT_NOT_FOUND_ERROR"),
    actualValues: z.object({
      projectId: z.ulid(),
    }),
  }),
});
