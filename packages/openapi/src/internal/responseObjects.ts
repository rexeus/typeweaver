import type {
  NormalizedResponse,
  NormalizedResponseUsage,
} from "@rexeus/typeweaver-gen";
import { buildHeaderObjects } from "./headerObjects.js";
import { escapeJsonPointerSegment } from "./jsonPointer.js";
import { createOperationLocation } from "./operationContext.js";
import {
  buildMergedResponseBody,
  buildResponseBody,
  inlineResponseBodyBaseName,
} from "./responseBodies.js";
import { buildMergedHeaders } from "./responseHeaderMerge.js";
import type {
  OpenApiBuildWarning,
  OpenApiDiagnosticWarning,
  OpenApiResponseObject,
  OpenApiResponsesObject,
} from "../types.js";
import type { OperationContext } from "./operationContext.js";
import type { SchemaRegistry } from "./schemaRegistry.js";

export type ResolvedResponseVariant = {
  readonly response: NormalizedResponse;
  readonly usage: NormalizedResponseUsage;
  readonly statusCode: string;
};

export type ResolvedResponseVariantsResult = {
  readonly variants: readonly ResolvedResponseVariant[];
  readonly warnings: readonly OpenApiBuildWarning[];
};

export type BuiltOperationResponse = {
  readonly response: OpenApiResponsesObject[string];
  readonly warnings: readonly OpenApiBuildWarning[];
};

export function resolveResponseVariants(
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

export function buildResponseForStatus(
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

export function groupResponsesByStatus(
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

export function buildResponseObject(
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

function resolveResponse(
  usage: NormalizedResponseUsage,
  canonicalResponsesByName: ReadonlyMap<string, NormalizedResponse>
): NormalizedResponse | undefined {
  return usage.source === "inline"
    ? usage.response
    : canonicalResponsesByName.get(usage.responseName);
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
