import type { JsonSchema } from "@rexeus/typeweaver-zod-to-json-schema";
import { createOperationLocation } from "./operationContext.js";
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
import type { OperationContext } from "./operationContext.js";
import type { z } from "zod";

export type ExtractParameterContainerOptions = {
  readonly schema: z.core.$ZodType | undefined;
  readonly context: OperationContext;
  readonly part: string;
  readonly containerPointer: string;
  readonly responseName?: string | undefined;
  readonly statusCode?: string | undefined;
};

export type ParameterContainerResult = {
  readonly properties: Record<string, JsonSchema>;
  readonly requiredNames: ReadonlySet<string>;
  readonly warnings: readonly OpenApiBuildWarning[];
  readonly isRootOptional: boolean;
};

function createContainerWarning(options: {
  readonly code: OpenApiDiagnosticWarning["code"];
  readonly message: string;
  readonly documentPath: string;
  readonly context: OperationContext;
  readonly part: string;
  readonly responseName?: string | undefined;
  readonly statusCode?: string | undefined;
}): OpenApiDiagnosticWarning {
  return {
    origin: "openapi-builder",
    code: options.code,
    message: options.message,
    documentPath: options.documentPath,
    location: createOperationLocation(options),
  };
}

const createContainerWarningFor = (
  options: ExtractParameterContainerOptions,
  warning: {
    readonly code: OpenApiDiagnosticWarning["code"];
    readonly message: string;
  }
): OpenApiDiagnosticWarning =>
  createContainerWarning({
    ...warning,
    documentPath: options.containerPointer,
    context: options.context,
    part: options.part,
    responseName: options.responseName,
    statusCode: options.statusCode,
  });

const buildContainerWarnings = (
  options: ExtractParameterContainerOptions,
  schema: JsonSchema,
  properties: Record<string, JsonSchema>
): OpenApiBuildWarning[] => {
  const warnings: OpenApiBuildWarning[] = [];
  const hasFiniteProperties = Object.keys(properties).length > 0;

  if (schema["type"] !== "object") {
    warnings.push(
      createContainerWarningFor(options, {
        code: "unrepresentable-parameter-container",
        message: `${options.part} must be a finite object schema to become OpenAPI parameters.`,
      })
    );
  } else if (
    !hasFiniteProperties &&
    hasUnrepresentableAdditionalProperties(schema)
  ) {
    warnings.push(
      createContainerWarningFor(options, {
        code: "unrepresentable-parameter-container",
        message: `${options.part} record entries cannot be represented as finite OpenAPI parameters.`,
      })
    );
  } else if (hasUnrepresentableAdditionalProperties(schema)) {
    warnings.push(
      createContainerWarningFor(options, {
        code: "unrepresentable-parameter-additional-properties",
        message: `${options.part} additional properties cannot be represented as OpenAPI parameters.`,
      })
    );
  }

  return warnings;
};

export function extractParameterContainer(
  options: ExtractParameterContainerOptions
): ParameterContainerResult {
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

  return {
    properties,
    requiredNames: getRequiredNames(converted.schema),
    warnings: [
      ...converted.warnings,
      ...buildContainerWarnings(options, converted.schema, properties),
    ],
    isRootOptional: optionalSchema.isOptional,
  };
}
