import { z } from "zod/v4";
import { metadataSchema } from "../shared/schemas/metadataSchema";

export const adSchema = z.object({
  id: z.ulid(),
  projectId: z.ulid(),
  instagram: z.object({
    headline: z.string(),
    description: z.string(),
    // 2048x2048 image
    imageUrl: z.url(),
    callToAction: z.string(),
    hashtags: z.array(z.string()),
  }),
  facebook: z.object({
    headline: z.string(),
    description: z.string(),
    // 2000x3820 image
    imageUrl: z.url(),
    callToAction: z.string(),
    hashtags: z.array(z.string()),
  }),
  ...metadataSchema.shape,
});
