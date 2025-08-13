import { z } from "zod/v4";

export const defaultRequestHeadersWithPayload = z.object({
  "Content-Type": z.literal("application/json"),
  Accept: z.literal("application/json"),
  Authorization: z.string(),
  "X-Single-Value": z.string().optional(),
  "X-Multi-Value": z.array(z.string()).optional(),
});

export const defaultRequestHeadersWithoutPayload = z.object({
  Accept: z.literal("application/json"),
  Authorization: z.string(),
  "X-Single-Value": z.string().optional(),
  "X-Multi-Value": z.array(z.string()).optional(),
});
