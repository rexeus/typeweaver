import type {
  NormalizedResponse,
  NormalizedResponseUsage,
} from "@rexeus/typeweaver-gen";
import { jsonPointer } from "./jsonPointer.js";
import {
  buildResponseForStatus,
  buildResponseObject,
  groupResponsesByStatus,
  resolveResponseVariants,
} from "./responseObjects.js";
import type {
  OpenApiBuildWarning,
  OpenApiResponseObject,
  OpenApiResponsesObject,
} from "../types.js";
import type { OperationContext } from "./operationContext.js";
import type { SchemaRegistry } from "./schemaRegistry.js";

export type ComponentsResponsesResult = {
  readonly responses: Record<string, OpenApiResponseObject>;
  readonly warnings: readonly OpenApiBuildWarning[];
};

export type OperationResponsesResult = {
  readonly responses: OpenApiResponsesObject;
  readonly warnings: readonly OpenApiBuildWarning[];
};

export function buildComponentsResponses(
  responses: readonly NormalizedResponse[],
  schemaRegistry: SchemaRegistry
): ComponentsResponsesResult {
  const warnings: OpenApiBuildWarning[] = [];
  const componentsResponses = Object.fromEntries(
    responses.map(response => {
      const responsePointer = jsonPointer([
        "components",
        "responses",
        response.name,
      ]);
      const built = buildResponseObject(response, {
        schemaRegistry,
        responseName: response.name,
        statusCode: String(response.statusCode),
        responsePointer,
        bodyBaseName: `${response.name}Body`,
      });

      warnings.push(...built.warnings);

      return [response.name, built.response];
    })
  );

  return { responses: componentsResponses, warnings };
}

export function buildOperationResponses(
  usages: readonly NormalizedResponseUsage[],
  canonicalResponsesByName: ReadonlyMap<string, NormalizedResponse>,
  context: OperationContext,
  schemaRegistry: SchemaRegistry
): OperationResponsesResult {
  const responsesPointer = operationResponsesPointer(context);
  const resolved = resolveResponseVariants(usages, {
    canonicalResponsesByName,
    context,
    responsesPointer,
  });
  const warnings: OpenApiBuildWarning[] = [...resolved.warnings];
  const responses: OpenApiResponsesObject = {};

  for (const [statusCode, variants] of groupResponsesByStatus(
    resolved.variants
  )) {
    const built = buildResponseForStatus(variants, {
      schemaRegistry,
      context,
      statusCode,
      responsePointer: `${responsesPointer}/${statusCode}`,
    });

    if (built === undefined) {
      continue;
    }

    responses[statusCode] = built.response;
    warnings.push(...built.warnings);
  }

  return { responses, warnings };
}

function operationResponsesPointer(context: OperationContext): string {
  return jsonPointer([
    "paths",
    context.openApiPath,
    context.method,
    "responses",
  ]);
}
