import { z } from "zod/v4";

export const defaultRequestHeadersWithPayload = z.object({
  "Content-Type": z.literal("application/json"),
  Accept: z.literal("application/json"),
  Authorization: z.string(),
});

export const defaultRequestHeadersWithoutPayload = z.object({
  Accept: z.literal("application/json"),
  Authorization: z.string(),
});
