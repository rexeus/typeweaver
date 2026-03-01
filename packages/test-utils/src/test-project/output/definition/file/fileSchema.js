import { z } from "zod";
export const fileMetadataSchema = z.object({
  id: z.ulid(),
  name: z.string(),
  size: z.number(),
  mimeType: z.string(),
  createdAt: z.string(),
});
