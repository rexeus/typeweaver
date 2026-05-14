import type { JsonSchema } from "@rexeus/typeweaver-zod-to-json-schema";
import { escapeJsonPointerSegment, jsonPointer } from "./jsonPointer.js";
import { convertSchema, unwrapRootOptional } from "./schemaConversion.js";
import type {
  OpenApiBuildWarning,
  OpenApiReferenceObject,
  OpenApiWarningLocation,
} from "../types.js";
import type { z } from "zod";

export type SchemaRegistry = {
  readonly register: (options: {
    readonly schema: z.core.$ZodType;
    readonly baseName: string;
    readonly location: OpenApiWarningLocation;
  }) => SchemaRegistration;
  readonly components: () => Record<string, JsonSchema>;
};

export type SchemaRegistration = {
  readonly name: string;
  readonly ref: OpenApiReferenceObject;
  readonly warnings: readonly OpenApiBuildWarning[];
};

type SchemaRegistryEntry = {
  readonly name: string;
  readonly ref: OpenApiReferenceObject;
  readonly schema: JsonSchema;
};

export function createSchemaRegistry(): SchemaRegistry {
  const entriesBySchema = new WeakMap<z.core.$ZodType, SchemaRegistryEntry>();
  const components = new Map<string, JsonSchema>();

  return {
    register: options => {
      const schema = unwrapRootOptional(options.schema).schema;
      const existingEntry = entriesBySchema.get(schema);

      if (existingEntry !== undefined) {
        return {
          name: existingEntry.name,
          ref: existingEntry.ref,
          warnings: [],
        };
      }

      const name = nextComponentName(options.baseName, components);
      const documentPath = jsonPointer(["components", "schemas", name]);
      const converted = convertSchema(schema, documentPath, options.location);
      const ref = {
        $ref: `#/components/schemas/${escapeJsonPointerSegment(name)}`,
      };
      const entry = { name, ref, schema: converted.schema };

      entriesBySchema.set(schema, entry);
      components.set(name, converted.schema);

      return { name, ref, warnings: converted.warnings };
    },
    components: () => Object.fromEntries(components),
  };
}

function nextComponentName(
  baseName: string,
  components: ReadonlyMap<string, JsonSchema>
): string {
  const sanitizedName = sanitizeComponentName(baseName);

  if (!components.has(sanitizedName)) {
    return sanitizedName;
  }

  for (let suffix = 2; ; suffix += 1) {
    const name = `${sanitizedName}_${suffix}`;

    if (!components.has(name)) {
      return name;
    }
  }
}

function sanitizeComponentName(name: string): string {
  const sanitizedName = name
    .trim()
    .replaceAll(/[^A-Za-z0-9._-]/g, "_")
    .replaceAll(/_+/g, "_")
    .replaceAll(/^_+|_+$/g, "");

  return sanitizedName === "" ? "Schema" : sanitizedName;
}
