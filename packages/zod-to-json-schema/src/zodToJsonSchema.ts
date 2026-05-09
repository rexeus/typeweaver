import { z } from "zod";
import {
  collectZodWarnings,
  createWarning,
} from "./internal/collectZodWarnings.js";
import { normalizeJsonSchema } from "./internal/normalizeJsonSchema.js";
import { getSchemaType } from "./internal/zodIntrospection.js";
import type { JsonSchema, ZodToJsonSchemaResult } from "./types.js";

export function fromZod(schema: z.core.$ZodType): ZodToJsonSchemaResult {
  const warnings = [...collectZodWarnings(schema)];

  try {
    const converted = z.toJSONSchema(schema as unknown as z.ZodType, {
      target: "draft-2020-12",
      unrepresentable: "any",
    }) as JsonSchema;

    return {
      schema: normalizeJsonSchema(stripRootSchemaDialect(converted)),
      warnings,
    };
  } catch (error) {
    warnings.push(
      createWarning({
        code: "conversion-error",
        schemaType: getSchemaType(schema),
        path: [],
        message:
          error instanceof Error
            ? error.message
            : "Failed to convert schema to JSON Schema.",
      })
    );

    return {
      schema: {},
      warnings,
    };
  }
}

function stripRootSchemaDialect(schema: JsonSchema): JsonSchema {
  return Object.fromEntries(
    Object.entries(schema).filter(([key]) => key !== "$schema")
  ) as JsonSchema;
}
