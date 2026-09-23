import { collectWarnings } from "./warningTraversal.js";
import type { ZodToJsonSchemaWarning } from "../types.js";
import type { ZodSchema } from "./zodIntrospection.js";
export function collectZodWarnings(
  schema: ZodSchema
): readonly ZodToJsonSchemaWarning[] {
  const collector = {
    warnings: [] as ZodToJsonSchemaWarning[],
    seen: new WeakSet<ZodSchema>(),
  };
  collectWarnings(schema, collector, []);
  return collector.warnings;
}
