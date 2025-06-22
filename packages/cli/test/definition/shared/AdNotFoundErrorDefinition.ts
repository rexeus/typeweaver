import NotFoundErrorDefinition from "./NotFoundErrorDefinition";
import { z } from "zod/v4";

export default NotFoundErrorDefinition.extend({
  name: "AdNotFoundError",
  description: "Ad not found",
  body: z.object({
    message: z.literal("Ad not found"),
    code: z.literal("AD_NOT_FOUND_ERROR"),
    actualValues: z.object({
      adId: z.ulid(),
    }),
  }),
});
