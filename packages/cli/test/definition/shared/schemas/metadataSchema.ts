import { z } from "zod/v4";

export const metadataSchema = z.object({
  createdAt: z.string(),
  modifiedAt: z.string(),
  createdBy: z.string(),
  modifiedBy: z.string(),
});
