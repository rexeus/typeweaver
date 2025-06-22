import UnprocessableEntityErrorDefinition from "./UnprocessableEntityErrorDefinition";
import { z } from "zod/v4";

export default UnprocessableEntityErrorDefinition.extend({
  name: "NonExistingFunnelError",
  description: "Non existing funnel",
  body: z.object({
    message: z.literal("Non existing funnel"),
    code: z.literal("NON_EXISTING_FUNNEL_ERROR"),
    actualValues: z.object({
      funnelId: z.ulid(),
    }),
  }),
});
