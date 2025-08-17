import { z } from "zod/v4";
import type { HttpBodySchema } from "@rexeus/typeweaver-core";
import type { ZodType } from "zod/v4";

export function listResponseSchema(schema: ZodType): HttpBodySchema {
  return z.object({
    results: z.array(schema),
    nextToken: z.string().optional(),
  });
}
