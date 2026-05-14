import type {
  NormalizedResponse,
  NormalizedResponseUsage,
} from "@rexeus/typeweaver-gen";
import type { JsonSchema } from "@rexeus/typeweaver-zod-to-json-schema";
import { pascalCase } from "polycase";
import { buildHeaderObjects } from "./headerObjects.js";
import { escapeJsonPointerSegment, jsonPointer } from "./jsonPointer.js";
import { createOperationLocation } from "./operationContext.js";
import type { OperationContext } from "./operationContext.js";
import { buildMergedHeaders } from "./responseHeaderMerge.js";
import type {
  OpenApiBuildWarning,
  OpenApiDiagnosticWarning,
  OpenApiReferenceObject,
  OpenApiResponseObject,
  OpenApiResponsesObject,
} from "../types.js";
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

type ResolvedResponseVariant = {
  readonly response: NormalizedResponse;
  readonly usage: NormalizedResponseUsage;
  readonly statusCode: string;
};

type ResolvedResponseVariantsResult = {
  readonly variants: readonly ResolvedResponseVariant[];
  readonly warnings: readonly OpenApiBuildWarning[];
};

type BuiltOperationResponse = {
  readonly response: OpenApiResponsesObject[string];
  readonly warnings: readonly OpenApiBuildWarning[];
};

function operationResponsesPointer(context: OperationContext): string {
  return jsonPointer([
    "paths",
    context.openApiPath,
    context.method,
    "responses",
  ]);
}

function resolveResponseVariants(
  usages: readonly NormalizedResponseUsage[],
  options: {
    readonly canonicalResponsesByName: ReadonlyMap<string, NormalizedResponse>;
    readonly context: OperationContext;
    readonly responsesPointer: string;
  }
): ResolvedResponseVariantsResult {
  const warnings: OpenApiBuildWarning[] = [];
  const variants: ResolvedResponseVariant[] = [];

  for (const usage of usages) {
    const response = resolveResponse(usage, options.canonicalResponsesByName);

    if (response === undefined) {
      warnings.push(
        createBuilderWarning({
          code: "missing-canonical-response",
          message: `Canonical response '${usage.responseName}' is not defined.`,
          documentPath: options.responsesPointer,
          context: options.context,
          part: "response",
          responseName: usage.responseName,
        })
      );
      continue;
    }

    variants.push({
      response,
      usage,
      statusCode: String(response.statusCode),
    });
  }

  return { variants, warnings };
}

function buildResponseForStatus(
  variants: readonly ResolvedResponseVariant[],
  options: {
    readonly schemaRegistry: SchemaRegistry;
    readonly context: OperationContext;
    readonly statusCode: string;
    readonly responsePointer: string;
  }
): BuiltOperationResponse | undefined {
  if (variants.length === 1) {
    const variant = variants[0];

    return variant === undefined
      ? undefined
      : buildSingleResponseVariant(variant, options);
  }

  return buildMergedResponseObject(variants, {
    schemaRegistry: options.schemaRegistry,
    context: options.context,
    statusCode: options.statusCode,
    responsePointer: options.responsePointer,
  });
}

function buildSingleResponseVariant(
  variant: ResolvedResponseVariant,
  options: {
    readonly schemaRegistry: SchemaRegistry;
    readonly context: OperationContext;
    readonly statusCode: string;
    readonly responsePointer: string;
  }
): BuiltOperationResponse {
  if (variant.usage.source === "canonical") {
    return {
      response: {
        $ref: `#/components/responses/${escapeJsonPointerSegment(
          variant.usage.responseName
        )}`,
      },
      warnings: [],
    };
  }

  const built = buildResponseObject(variant.response, {
    schemaRegistry: options.schemaRegistry,
    context: options.context,
    responseName: variant.usage.responseName,
    statusCode: options.statusCode,
    responsePointer: options.responsePointer,
    bodyBaseName: inlineResponseBodyBaseName(
      options.context,
      variant.usage.responseName
    ),
  });

  return { response: built.response, warnings: built.warnings };
}

function groupResponsesByStatus(
  variants: readonly ResolvedResponseVariant[]
): ReadonlyMap<string, readonly ResolvedResponseVariant[]> {
  const groups = new Map<string, ResolvedResponseVariant[]>();

  for (const variant of variants) {
    const group = groups.get(variant.statusCode);

    if (group === undefined) {
      groups.set(variant.statusCode, [variant]);
      continue;
    }

    group.push(variant);
  }

  return groups;
}

function resolveResponse(
  usage: NormalizedResponseUsage,
  canonicalResponsesByName: ReadonlyMap<string, NormalizedResponse>
): NormalizedResponse | undefined {
  return usage.source === "inline"
    ? usage.response
    : canonicalResponsesByName.get(usage.responseName);
}

function buildResponseObject(
  response: NormalizedResponse,
  options: {
    readonly schemaRegistry: SchemaRegistry;
    readonly context?: OperationContext;
    readonly responseName: string;
    readonly statusCode: string;
    readonly responsePointer: string;
    readonly bodyBaseName: string;
  }
): {
  readonly response: OpenApiResponseObject;
  readonly warnings: readonly OpenApiBuildWarning[];
} {
  const context =
    options.context ?? createComponentResponseContext(options.responseName);
  const headers = buildHeaderObjects(response.header, context, {
    responseName: options.responseName,
    statusCode: options.statusCode,
    part: "response.header",
    headersPointer: `${options.responsePointer}/headers`,
  });
  const body = buildResponseBody(response, {
    schemaRegistry: options.schemaRegistry,
    context,
    responseName: options.responseName,
    statusCode: options.statusCode,
    baseName: options.bodyBaseName,
  });

  return {
    response: {
      description: response.description,
      ...(Object.keys(headers.headers).length > 0
        ? { headers: headers.headers }
        : {}),
      ...(body.content === undefined ? {} : { content: body.content }),
    },
    warnings: [...headers.warnings, ...body.warnings],
  };
}

function buildResponseBody(
  response: NormalizedResponse,
  options: {
    readonly schemaRegistry: SchemaRegistry;
    readonly context: OperationContext;
    readonly responseName: string;
    readonly statusCode: string;
    readonly baseName: string;
  }
): {
  readonly content?: OpenApiResponseObject["content"];
  readonly warnings: readonly OpenApiBuildWarning[];
} {
  if (response.body === undefined) {
    return { warnings: [] };
  }

  const registration = registerResponseBody(response.body, {
    schemaRegistry: options.schemaRegistry,
    context: options.context,
    responseName: options.responseName,
    statusCode: options.statusCode,
    baseName: options.baseName,
  });

  return {
    content: {
      "application/json": {
        schema: registration.ref,
      },
    },
    warnings: registration.warnings,
  };
}

function buildMergedResponseObject(
  variants: readonly ResolvedResponseVariant[],
  options: {
    readonly schemaRegistry: SchemaRegistry;
    readonly context: OperationContext;
    readonly statusCode: string;
    readonly responsePointer: string;
  }
): {
  readonly response: OpenApiResponseObject;
  readonly warnings: readonly OpenApiBuildWarning[];
} {
  const body = buildMergedResponseBody(variants, options);
  const headers = buildMergedHeaders(variants, options);

  return {
    response: {
      description: variants
        .map(
          variant =>
            `${variant.usage.responseName}: ${variant.response.description}`
        )
        .join("\n\n"),
      ...(Object.keys(headers.headers).length > 0
        ? { headers: headers.headers }
        : {}),
      ...(body.content === undefined ? {} : { content: body.content }),
    },
    warnings: [...body.warnings, ...headers.warnings],
  };
}

function buildMergedResponseBody(
  variants: readonly ResolvedResponseVariant[],
  options: {
    readonly schemaRegistry: SchemaRegistry;
    readonly context: OperationContext;
    readonly statusCode: string;
  }
): {
  readonly content?: OpenApiResponseObject["content"];
  readonly warnings: readonly OpenApiBuildWarning[];
} {
  const warnings: OpenApiBuildWarning[] = [];
  const refs: OpenApiReferenceObject[] = [];

  for (const variant of variants) {
    if (variant.response.body === undefined) {
      continue;
    }

    const registration = registerResponseBody(variant.response.body, {
      schemaRegistry: options.schemaRegistry,
      context: options.context,
      baseName: responseBodyBaseName(options.context, variant.usage),
      responseName: variant.usage.responseName,
      statusCode: options.statusCode,
    });

    refs.push(registration.ref);
    warnings.push(...registration.warnings);
  }

  const distinctRefs = distinctBy(refs, ref => ref.$ref);
  const [firstRef, ...otherRefs] = distinctRefs;

  if (firstRef === undefined) {
    return { warnings };
  }

  const schema: JsonSchema =
    otherRefs.length === 0 ? firstRef : { anyOf: distinctRefs };

  return {
    content: {
      "application/json": { schema },
    },
    warnings,
  };
}

function registerResponseBody(
  body: NonNullable<NormalizedResponse["body"]>,
  options: {
    readonly schemaRegistry: SchemaRegistry;
    readonly context: OperationContext;
    readonly responseName: string;
    readonly statusCode: string;
    readonly baseName: string;
  }
) {
  return options.schemaRegistry.register({
    schema: body,
    baseName: options.baseName,
    location: createOperationLocation({
      context: options.context,
      part: "response.body",
      responseName: options.responseName,
      statusCode: options.statusCode,
    }),
  });
}

function responseBodyBaseName(
  context: OperationContext,
  usage: NormalizedResponseUsage
): string {
  return usage.source === "canonical"
    ? `${usage.responseName}Body`
    : inlineResponseBodyBaseName(context, usage.responseName);
}

function inlineResponseBodyBaseName(
  context: OperationContext,
  responseName: string
): string {
  return `${pascalCase(context.operation.operationId)}${responseName}Body`;
}

function distinctBy<T>(
  values: readonly T[],
  keyForValue: (value: T) => string
): readonly T[] {
  const seen = new Set<string>();
  const distinctValues: T[] = [];

  for (const value of values) {
    const key = keyForValue(value);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    distinctValues.push(value);
  }

  return distinctValues;
}

function createComponentResponseContext(
  responseName: string
): OperationContext {
  return {
    resourceName: "components.responses",
    operation: {
      operationId: responseName,
      method: "components",
      path: "#/components/responses",
    },
    openApiPath: "#/components/responses",
    method: "components",
  };
}

function createBuilderWarning(options: {
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
