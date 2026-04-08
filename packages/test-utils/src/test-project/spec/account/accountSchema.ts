import { z } from "zod";
import { metadataSchema } from "../shared/index.js";

export const accountSchema = z.object({
  id: z.string().max(256),
  email: z.email().max(256),
  ...metadataSchema.shape,
});
