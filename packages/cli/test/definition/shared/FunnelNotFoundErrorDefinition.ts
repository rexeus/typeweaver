import NotFoundErrorDefinition from "./NotFoundErrorDefinition";
import { z } from "zod/v4";

export default NotFoundErrorDefinition.extend({
  name: "FunnelNotFoundError",
  description: "Funnel not found",
  body: z.object({
    message: z.literal("Funnel not found"),
    code: z.literal("FUNNEL_NOT_FOUND_ERROR"),
    actualValues: z.object({
      funnelId: z.ulid(),
    }),
  }),
});
