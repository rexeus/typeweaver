import { z } from "zod";

export const metadataSchema = z.object({
  createdAt: z.string(),
  modifiedAt: z.string(),
  createdBy: z.string(),
  modifiedBy: z.string(),
});
