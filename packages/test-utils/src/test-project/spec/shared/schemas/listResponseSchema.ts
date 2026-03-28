import type { HttpBodySchema } from "@rexeus/typeweaver-core";
import { z } from "zod";
import type { ZodType } from "zod";

export function listResponseSchema(schema: ZodType): HttpBodySchema {
  return z.object({
    results: z.array(schema),
    nextToken: z.string().optional(),
  });
}
