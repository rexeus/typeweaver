import { z } from "zod";
import { collectZodWarnings } from "./internal/collectZodWarnings.js";
import { isJsonSchemaObject } from "./internal/jsonSchemaGuards.js";
import { normalizeJsonSchema } from "./internal/normalizeJsonSchema.js";
import { createWarning } from "./internal/warningRules.js";
import { getSchemaType } from "./internal/zodIntrospection.js";
import type {
  JsonSchema,
  ZodToJsonSchemaResult,
  ZodToJsonSchemaWarning,
} from "./types.js";

export function fromZod(schema: z.core.$ZodType): ZodToJsonSchemaResult {
  const warnings = [...collectZodWarnings(schema)];

  try {
    const converted: unknown = z.toJSONSchema(schema, {
      target: "draft-2020-12",
      unrepresentable: "any",
    });
    // Zod finalizes the document through a JSON round trip, so this holds for
    // every successful conversion.
    if (!isJsonSchemaObject(converted)) {
      throw new TypeError(
        "Zod produced a JSON Schema that is not a JSON object."
      );
    }

    return {
      schema: normalizeJsonSchema(stripRootSchemaDialect(converted)),
      warnings,
    };
  } catch (error) {
    if (!warnings.some(isRootConversionWarning)) {
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
    }

    return {
      schema: {},
      warnings,
    };
  }
}

function isRootConversionWarning(warning: ZodToJsonSchemaWarning): boolean {
  return warning.code === "conversion-error" && warning.path === "";
}

function stripRootSchemaDialect(schema: JsonSchema): JsonSchema {
  return Object.fromEntries(
    Object.entries(schema).filter(([key]) => key !== "$schema")
  );
}
