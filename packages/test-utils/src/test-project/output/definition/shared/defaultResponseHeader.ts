import { z } from "zod/v4";

export const defaultResponseHeader = z.object({
  "Content-Type": z.literal("application/json"),
  "X-Single-Value": z.string().optional(),
  "X-Multi-Value": z.array(z.string()).optional(),
});
