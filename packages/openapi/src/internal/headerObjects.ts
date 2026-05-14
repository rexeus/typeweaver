import type { JsonSchema } from "@rexeus/typeweaver-zod-to-json-schema";
import { extractParameterContainer } from "./parameterContainer.js";
import {
  escapeJsonPointerSegment,
  isJsonPointerAtOrBelow,
} from "./jsonPointer.js";
import type { OperationContext } from "./operationContext.js";
import { rebaseLocalJsonSchemaRefs } from "./schemaConversion.js";
import type { OpenApiBuildWarning, OpenApiHeaderObject } from "../types.js";
import type { z } from "zod";

export type HeaderObjectResult = {
  readonly headers: Record<string, OpenApiHeaderObject>;
  readonly warnings: readonly OpenApiBuildWarning[];
};

export function buildHeaderObjects(
  schema: z.core.$ZodType | undefined,
  context: OperationContext,
  responseContext: {
    readonly responseName?: string;
    readonly statusCode: string;
    readonly part: string;
    readonly headersPointer: string;
  }
): HeaderObjectResult {
  const container = extractParameterContainer({
    schema,
    context,
    part: responseContext.part,
    containerPointer: responseContext.headersPointer,
    responseName: responseContext.responseName,
    statusCode: responseContext.statusCode,
  });
  const headers = Object.fromEntries(
    Object.entries(container.properties).map(([name, headerSchema]) => {
      const headerPointer = `${responseContext.headersPointer}/${escapeJsonPointerSegment(
        name
      )}/schema`;
      const description = headerDescription(headerSchema);

      return [
        name,
        {
          ...(description === undefined ? {} : { description }),
          required:
            !container.isRootOptional && container.requiredNames.has(name),
          schema: rebaseLocalJsonSchemaRefs(
            schemaWithoutDescription(headerSchema),
            headerPointer
          ),
        },
      ];
    })
  );

  return {
    headers,
    warnings: rebaseHeaderSchemaWarnings(
      container.warnings,
      Object.keys(container.properties),
      responseContext.headersPointer
    ),
  };
}

function headerDescription(schema: JsonSchema): string | undefined {
  return typeof schema.description === "string" &&
    schema.description.trim() !== ""
    ? schema.description
    : undefined;
}

function schemaWithoutDescription(schema: JsonSchema): JsonSchema {
  return Object.fromEntries(
    Object.entries(schema).filter(([key]) => key !== "description")
  ) as JsonSchema;
}

function rebaseHeaderSchemaWarnings(
  warnings: readonly OpenApiBuildWarning[],
  headerNames: readonly string[],
  headersPointer: string
): readonly OpenApiBuildWarning[] {
  return warnings.map(warning => {
    if (warning.origin !== "schema-conversion") {
      return warning;
    }

    const headerName = headerNames.find(name =>
      isJsonPointerAtOrBelow(
        warning.schemaPath,
        `/properties/${escapeJsonPointerSegment(name)}`
      )
    );

    if (headerName === undefined) {
      return warning;
    }

    const schemaPath = `/properties/${escapeJsonPointerSegment(headerName)}`;
    const suffix = warning.schemaPath.slice(schemaPath.length);

    return {
      ...warning,
      documentPath: `${headersPointer}/${escapeJsonPointerSegment(
        headerName
      )}/schema${suffix}`,
      location: {
        ...warning.location,
        parameterName: headerName,
      },
    };
  });
}
