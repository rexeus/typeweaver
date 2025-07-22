import { z } from "zod/v4";
import { metadataSchema } from "../shared";

export const todoStatus = z.enum(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"]);

export const todoSchema = z.object({
  id: z.ulid(),
  accountId: z.ulid(),
  parentId: z.ulid().optional(),
  title: z.string(),
  description: z.string().optional(),
  status: todoStatus,
  dueDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  ...metadataSchema.shape,
});
