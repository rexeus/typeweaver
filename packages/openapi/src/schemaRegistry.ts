import { fromZod } from "@rexeus/typeweaver-zod-to-json-schema";
import type { ZodToJsonSchemaWarning } from "@rexeus/typeweaver-zod-to-json-schema";
import type { OpenApiWarning } from "./types.js";
import type { $ZodType } from "zod/v4/core";

type JsonSchemaObject = Record<string, unknown>;

export type SchemaRegistry = {
  readonly register: (params: {
    readonly name: string;
    readonly schema: $ZodType;
    readonly location: string;
  }) => { readonly $ref: string };
  readonly convertInline: (params: {
    readonly schema: $ZodType;
    readonly location: string;
  }) => JsonSchemaObject;
  readonly getComponents: () => Record<string, JsonSchemaObject>;
  readonly getWarnings: () => readonly OpenApiWarning[];
};

export function createSchemaRegistry(): SchemaRegistry {
  const components = new Map<string, JsonSchemaObject>();
  const warnings: OpenApiWarning[] = [];

  const pushWarnings = (
    location: string,
    nextWarnings: readonly ZodToJsonSchemaWarning[]
  ): void => {
    for (const warning of nextWarnings) {
      warnings.push({
        code: warning.code,
        location,
        message: `${warning.message} (${warning.path})`,
      });
    }
  };

  return {
    register: params => {
      const resolvedName = reserveName(components, params.name);
      const result = fromZod(params.schema);
      components.set(resolvedName, result.schema);
      pushWarnings(params.location, result.warnings);

      return {
        $ref: `#/components/schemas/${resolvedName}`,
      };
    },
    convertInline: params => {
      const result = fromZod(params.schema);
      pushWarnings(params.location, result.warnings);
      return result.schema;
    },
    getComponents: () => {
      return Object.fromEntries(components.entries());
    },
    getWarnings: () => warnings,
  };
}

function reserveName(
  components: ReadonlyMap<string, JsonSchemaObject>,
  requestedName: string
): string {
  if (!components.has(requestedName)) {
    return requestedName;
  }

  let index = 2;
  while (components.has(`${requestedName}${index}`)) {
    index += 1;
  }

  return `${requestedName}${index}`;
}
