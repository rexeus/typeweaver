import type { JsonSchema } from "@rexeus/typeweaver-zod-to-json-schema";
import { createOperationLocation } from "./operationContext.js";
import type { OperationContext } from "./operationContext.js";
import {
  convertSchema,
  getObjectProperties,
  getRequiredNames,
  hasUnrepresentableAdditionalProperties,
  preserveReferencedRootDefinitions,
  unwrapRootOptional,
} from "./schemaConversion.js";
import type {
  OpenApiBuildWarning,
  OpenApiDiagnosticWarning,
} from "../types.js";
import type { z } from "zod";

export type ParameterContainerResult = {
  readonly properties: Record<string, JsonSchema>;
  readonly requiredNames: ReadonlySet<string>;
  readonly warnings: readonly OpenApiBuildWarning[];
  readonly isRootOptional: boolean;
};

export function extractParameterContainer(options: {
  readonly schema: z.core.$ZodType | undefined;
  readonly context: OperationContext;
  readonly part: string;
  readonly containerPointer: string;
  readonly responseName?: string;
  readonly statusCode?: string;
}): ParameterContainerResult {
  if (options.schema === undefined) {
    return {
      properties: {},
      requiredNames: new Set(),
      warnings: [],
      isRootOptional: false,
    };
  }

  const optionalSchema = unwrapRootOptional(options.schema);
  const converted = convertSchema(
    optionalSchema.schema,
    options.containerPointer,
    createOperationLocation({
      context: options.context,
      part: options.part,
      responseName: options.responseName,
      statusCode: options.statusCode,
    }),
    { rebaseLocalRefs: false }
  );
  const properties = Object.fromEntries(
    Object.entries(getObjectProperties(converted.schema)).map(
      ([name, schema]) => [
        name,
        preserveReferencedRootDefinitions(schema, converted.schema),
      ]
    )
  );
  const warnings: OpenApiBuildWarning[] = [...converted.warnings];
  const hasFiniteProperties = Object.keys(properties).length > 0;

  if (converted.schema.type !== "object") {
    warnings.push(
      createContainerWarning({
        code: "unrepresentable-parameter-container",
        message: `${options.part} must be a finite object schema to become OpenAPI parameters.`,
        documentPath: options.containerPointer,
        context: options.context,
        part: options.part,
        responseName: options.responseName,
        statusCode: options.statusCode,
      })
    );
  } else if (
    !hasFiniteProperties &&
    hasUnrepresentableAdditionalProperties(converted.schema)
  ) {
    warnings.push(
      createContainerWarning({
        code: "unrepresentable-parameter-container",
        message: `${options.part} record entries cannot be represented as finite OpenAPI parameters.`,
        documentPath: options.containerPointer,
        context: options.context,
        part: options.part,
        responseName: options.responseName,
        statusCode: options.statusCode,
      })
    );
  } else if (hasUnrepresentableAdditionalProperties(converted.schema)) {
    warnings.push(
      createContainerWarning({
        code: "unrepresentable-parameter-additional-properties",
        message: `${options.part} additional properties cannot be represented as OpenAPI parameters.`,
        documentPath: options.containerPointer,
        context: options.context,
        part: options.part,
        responseName: options.responseName,
        statusCode: options.statusCode,
      })
    );
  }

  return {
    properties,
    requiredNames: getRequiredNames(converted.schema),
    warnings,
    isRootOptional: optionalSchema.isOptional,
  };
}

function createContainerWarning(options: {
  readonly code: OpenApiDiagnosticWarning["code"];
  readonly message: string;
  readonly documentPath: string;
  readonly context: OperationContext;
  readonly part: string;
  readonly responseName?: string;
  readonly statusCode?: string;
}): OpenApiDiagnosticWarning {
  return {
    origin: "openapi-builder",
    code: options.code,
    message: options.message,
    documentPath: options.documentPath,
    location: createOperationLocation(options),
  };
}
