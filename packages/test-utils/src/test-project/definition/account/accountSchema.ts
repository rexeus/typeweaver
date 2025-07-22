import { z } from "zod/v4";
import { metadataSchema } from "../shared";

export const accountSchema = z.object({
  id: z.string().max(256),
  email: z.email().max(256),
  ...metadataSchema.shape,
});
