import { z } from "zod";

export const defaultResponseHeader = z.object({
  "Content-Type": z.literal("application/json"),
  "X-Single-Value": z.string().optional(),
  "X-Multi-Value": z.array(z.string()).optional(),
});
