import UnprocessableEntityErrorDefinition from "./UnprocessableEntityErrorDefinition";
import { z } from "zod/v4";

export default UnprocessableEntityErrorDefinition.extend({
  name: "NonExistingAdError",
  description: "Non existing ad",
  body: z.object({
    message: z.literal("Non existing ad"),
    code: z.literal("NON_EXISTING_AD_ERROR"),
    actualValues: z.object({
      adId: z.ulid(),
    }),
  }),
});
