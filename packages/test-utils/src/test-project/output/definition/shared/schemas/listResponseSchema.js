import { z } from "zod";
export function listResponseSchema(schema) {
  return z.object({
    results: z.array(schema),
    nextToken: z.string().optional(),
  });
}
