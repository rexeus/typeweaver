import { toPascalCase } from "@rexeus/typeweaver-gen";
import type {
  NormalizedOperation,
  NormalizedRequest,
  NormalizedResponse,
  NormalizedResponseUsage,
} from "@rexeus/typeweaver-gen";
import { getSchemaType } from "@rexeus/typeweaver-zod-to-json-schema";
import { createSchemaRegistry } from "./schemaRegistry.js";
import type {
  OpenApiBuildResult,
  OpenApiBuilderInput,
  OpenApiPluginConfig,
} from "./types.js";
import type { $ZodObject, $ZodType } from "zod/v4/core";

type JsonSchemaObject = Record<string, unknown>;
type OpenApiParameters = readonly JsonSchemaObject[];

const JSON_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";
const DEFAULT_INFO = {
  title: "Typeweaver API",
  version: "0.0.0",
} as const;

export const MERGED_DUPLICATE_STATUS_RESPONSE =
  "MERGED_DUPLICATE_STATUS_RESPONSE" as const;

export function buildOpenApiDocument(
  input: OpenApiBuilderInput
): OpenApiBuildResult {
  const registry = createSchemaRegistry();
  const canonicalResponsesByName = new Map(
    input.normalizedSpec.responses.map(response => [response.name, response])
  );
  const paths: Record<string, JsonSchemaObject> = {};
  const componentResponses: Record<string, JsonSchemaObject> = {};

  for (const response of input.normalizedSpec.responses) {
    componentResponses[response.name] = buildResponseObject({
      response,
      location: `response:${response.name}`,
      bodySchemaName: `${toPascalCase(response.name)}Body`,
      registry,
    });
  }

  for (const resource of input.normalizedSpec.resources) {
    for (const operation of resource.operations) {
      const pathKey = toOpenApiPath(operation.path);
      const pathItem = paths[pathKey] ?? {};

      pathItem[operation.method.toLowerCase()] = buildOperationObject({
        resourceName: resource.name,
        operation,
        canonicalResponsesByName,
        registry,
      });

      paths[pathKey] = pathItem;
    }
  }

  return {
    document: omitUndefinedEntries({
      openapi: "3.1.1",
      jsonSchemaDialect: JSON_SCHEMA_DIALECT,
      info: resolveInfo(input.config),
      servers: input.config?.servers,
      paths,
      components: {
        schemas: registry.getComponents(),
        responses: componentResponses,
      },
    }),
    warnings: registry.getWarnings(),
  };
}

export function toOpenApiPath(path: string): string {
  return path.replaceAll(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function buildOperationObject(params: {
  readonly resourceName: string;
  readonly operation: NormalizedOperation;
  readonly canonicalResponsesByName: ReadonlyMap<string, NormalizedResponse>;
  readonly registry: ReturnType<typeof createSchemaRegistry>;
}): JsonSchemaObject {
  const operationPrefix = `${toPascalCase(params.resourceName)}${toPascalCase(params.operation.operationId)}`;
  const parameters = buildParameters({
    operation: params.operation,
    locationPrefix: `operation:${params.operation.operationId}`,
    registry: params.registry,
  });

  return omitUndefinedEntries({
    operationId: params.operation.operationId,
    summary: params.operation.summary,
    parameters,
    requestBody: buildRequestBody({
      request: params.operation.request,
      schemaName: `${operationPrefix}RequestBody`,
      location: `operation:${params.operation.operationId}:requestBody`,
      registry: params.registry,
    }),
    responses: buildResponsesMap({
      resourceName: params.resourceName,
      operation: params.operation,
      canonicalResponsesByName: params.canonicalResponsesByName,
      registry: params.registry,
    }),
  });
}

function buildResponsesMap(params: {
  readonly resourceName: string;
  readonly operation: NormalizedOperation;
  readonly canonicalResponsesByName: ReadonlyMap<string, NormalizedResponse>;
  readonly registry: ReturnType<typeof createSchemaRegistry>;
}): Record<string, JsonSchemaObject> {
  const byStatusCode = new Map<string, NormalizedResponseUsage[]>();
  for (const responseUsage of params.operation.responses) {
    const statusCode = getResponseStatusCode(
      responseUsage,
      params.canonicalResponsesByName
    );
    const existing = byStatusCode.get(statusCode);
    if (existing === undefined) {
      byStatusCode.set(statusCode, [responseUsage]);
    } else {
      existing.push(responseUsage);
    }
  }

  const responses: Record<string, JsonSchemaObject> = {};
  for (const [statusCode, usages] of byStatusCode) {
    responses[statusCode] =
      usages.length === 1
        ? buildResponseUsageObject({
            resourceName: params.resourceName,
            operation: params.operation,
            responseUsage: usages[0]!,
            canonicalResponsesByName: params.canonicalResponsesByName,
            registry: params.registry,
          })
        : buildMergedResponse({
            resourceName: params.resourceName,
            operation: params.operation,
            statusCode,
            usages,
            canonicalResponsesByName: params.canonicalResponsesByName,
            registry: params.registry,
          });
  }

  return responses;
}

// OpenAPI 3.1 allows exactly one response object per status code, so when an
// operation declares multiple (e.g. two distinct 404 shapes) we flatten them
// into a single entry whose body schema is a `oneOf` of each variant. Headers
// travel along only when every variant declares the identical schema (shared
// import): OpenAPI has no way to vary headers per variant, so we refuse to
// invent a union there.
function buildMergedResponse(params: {
  readonly resourceName: string;
  readonly operation: NormalizedOperation;
  readonly statusCode: string;
  readonly usages: readonly NormalizedResponseUsage[];
  readonly canonicalResponsesByName: ReadonlyMap<string, NormalizedResponse>;
  readonly registry: ReturnType<typeof createSchemaRegistry>;
}): JsonSchemaObject {
  const operationPrefix = `${toPascalCase(params.resourceName)}${toPascalCase(params.operation.operationId)}`;
  const bodySchemas: JsonSchemaObject[] = [];
  const descriptions: string[] = [];
  const variantNames: string[] = [];
  const headerSchemas: ($ZodType | undefined)[] = [];
  const location = `operation:${params.operation.operationId}:response:${params.statusCode}`;

  for (const usage of params.usages) {
    const response = resolveResponse(usage, params.canonicalResponsesByName);
    variantNames.push(response.name);
    headerSchemas.push(response.header);
    if (response.description.length > 0) {
      descriptions.push(`${response.name}: ${response.description}`);
    }

    const bodySchema = resolveVariantBodySchema({
      usage,
      response,
      operationPrefix,
      location,
      registry: params.registry,
    });
    if (bodySchema !== undefined) {
      bodySchemas.push(bodySchema);
    }
  }

  const sharedHeader = findSharedHeaderSchema(headerSchemas);
  if (sharedHeader === "divergent") {
    params.registry.addWarning({
      code: MERGED_DUPLICATE_STATUS_RESPONSE,
      location: `${location}:headers`,
      message: `Dropped headers at status ${params.statusCode}: variants declare different header schemas which OpenAPI 3.1 cannot express per-variant (variants: ${variantNames.join(", ")}).`,
    });
  }

  params.registry.addWarning({
    code: MERGED_DUPLICATE_STATUS_RESPONSE,
    location,
    message: `${variantNames.length} responses at status ${params.statusCode} merged into one (variants: ${variantNames.join(", ")}).`,
  });

  const description =
    descriptions.length > 0
      ? descriptions.join(" / ")
      : `Multiple responses at status ${params.statusCode}.`;

  return omitUndefinedEntries({
    description,
    headers:
      sharedHeader !== undefined && sharedHeader !== "divergent"
        ? buildHeaders({
            schema: sharedHeader,
            location: `${location}:headers`,
            registry: params.registry,
          })
        : undefined,
    content: buildMergedContent(bodySchemas),
  });
}

function resolveVariantBodySchema(params: {
  readonly usage: NormalizedResponseUsage;
  readonly response: NormalizedResponse;
  readonly operationPrefix: string;
  readonly location: string;
  readonly registry: ReturnType<typeof createSchemaRegistry>;
}): JsonSchemaObject | undefined {
  if (params.response.body === undefined) {
    return undefined;
  }

  if (params.usage.source === "canonical") {
    // Canonical bodies are registered by the top-level pass under the
    // `${PascalCase(name)}Body` slot, so we can point straight at the
    // existing ref instead of re-registering (which would append a `2`
    // suffix via reserveName).
    return {
      $ref: `#/components/schemas/${toPascalCase(params.response.name)}Body`,
    };
  }

  return params.registry.register({
    name: `${params.operationPrefix}${toPascalCase(params.response.name)}Body`,
    schema: params.response.body,
    location: `${params.location}:${params.response.name}:body`,
  });
}

function buildMergedContent(
  bodySchemas: readonly JsonSchemaObject[]
): JsonSchemaObject | undefined {
  if (bodySchemas.length === 0) {
    return undefined;
  }

  return {
    "application/json": {
      schema:
        bodySchemas.length === 1 ? bodySchemas[0]! : { oneOf: bodySchemas },
    },
  };
}

// Returns the shared schema when every variant points at the exact same
// instance, `undefined` when no variant declares headers, or the sentinel
// `"divergent"` when variants disagree.
function findSharedHeaderSchema(
  headerSchemas: readonly ($ZodType | undefined)[]
): $ZodType | undefined | "divergent" {
  const withHeaders = headerSchemas.filter(
    (schema): schema is $ZodType => schema !== undefined
  );
  if (withHeaders.length === 0) {
    return undefined;
  }
  if (withHeaders.length !== headerSchemas.length) {
    return "divergent";
  }

  const [first] = withHeaders;
  return withHeaders.every(schema => schema === first) ? first : "divergent";
}

function resolveResponse(
  usage: NormalizedResponseUsage,
  canonicalResponsesByName: ReadonlyMap<string, NormalizedResponse>
): NormalizedResponse {
  if (usage.source === "inline") {
    return usage.response;
  }

  const response = canonicalResponsesByName.get(usage.responseName);
  if (response === undefined) {
    throw new Error(`Missing canonical response '${usage.responseName}'.`);
  }
  return response;
}

function buildParameters(params: {
  readonly operation: NormalizedOperation;
  readonly locationPrefix: string;
  readonly registry: ReturnType<typeof createSchemaRegistry>;
}): OpenApiParameters {
  const parameters = [
    ...buildParametersForLocation({
      container: params.operation.request?.param,
      location: "path",
      forceRequired: true,
      warningLocation: `${params.locationPrefix}:path`,
      registry: params.registry,
    }),
    ...buildParametersForLocation({
      container: params.operation.request?.query,
      location: "query",
      forceRequired: false,
      warningLocation: `${params.locationPrefix}:query`,
      registry: params.registry,
    }),
    ...buildParametersForLocation({
      container: params.operation.request?.header,
      location: "header",
      forceRequired: false,
      warningLocation: `${params.locationPrefix}:header`,
      registry: params.registry,
    }),
  ];

  return parameters;
}

function buildParametersForLocation(params: {
  readonly container: $ZodType | undefined;
  readonly location: "path" | "query" | "header";
  readonly forceRequired: boolean;
  readonly warningLocation: string;
  readonly registry: ReturnType<typeof createSchemaRegistry>;
}): JsonSchemaObject[] {
  if (params.container === undefined) {
    return [];
  }

  const objectSchema = unwrapObjectSchema(params.container);
  if (objectSchema === undefined) {
    return [];
  }

  const converted = params.registry.convertInline({
    schema: objectSchema,
    location: params.warningLocation,
  });
  const propertySchemas = getObjectPropertySchemas(converted);
  const requiredProperties = new Set(getRequiredPropertyNames(converted));

  return Object.entries(propertySchemas).map(([name, schema]) => {
    return {
      in: params.location,
      name,
      required: params.forceRequired || requiredProperties.has(name),
      schema,
    };
  });
}

function buildRequestBody(params: {
  readonly request: NormalizedRequest | undefined;
  readonly schemaName: string;
  readonly location: string;
  readonly registry: ReturnType<typeof createSchemaRegistry>;
}): JsonSchemaObject | undefined {
  if (params.request?.body === undefined) {
    return undefined;
  }

  return {
    required: true,
    content: {
      "application/json": {
        schema: params.registry.register({
          name: params.schemaName,
          schema: params.request.body,
          location: params.location,
        }),
      },
    },
  };
}

function buildResponseUsageObject(params: {
  readonly resourceName: string;
  readonly operation: NormalizedOperation;
  readonly responseUsage: NormalizedResponseUsage;
  readonly canonicalResponsesByName: ReadonlyMap<string, NormalizedResponse>;
  readonly registry: ReturnType<typeof createSchemaRegistry>;
}): JsonSchemaObject {
  if (params.responseUsage.source === "canonical") {
    return {
      $ref: `#/components/responses/${params.responseUsage.responseName}`,
    };
  }

  const bodySchemaName = `${toPascalCase(params.resourceName)}${toPascalCase(params.operation.operationId)}${toPascalCase(params.responseUsage.response.name)}Body`;

  return buildResponseObject({
    response: params.responseUsage.response,
    location: `operation:${params.operation.operationId}:response:${params.responseUsage.response.name}`,
    bodySchemaName,
    registry: params.registry,
  });
}

function buildResponseObject(params: {
  readonly response: NormalizedResponse;
  readonly location: string;
  readonly bodySchemaName: string;
  readonly registry: ReturnType<typeof createSchemaRegistry>;
}): JsonSchemaObject {
  return omitUndefinedEntries({
    description: params.response.description,
    headers: buildHeaders({
      schema: params.response.header,
      location: `${params.location}:headers`,
      registry: params.registry,
    }),
    content:
      params.response.body === undefined
        ? undefined
        : {
            "application/json": {
              schema: params.registry.register({
                name: params.bodySchemaName,
                schema: params.response.body,
                location: `${params.location}:body`,
              }),
            },
          },
  });
}

function buildHeaders(params: {
  readonly schema: $ZodType | undefined;
  readonly location: string;
  readonly registry: ReturnType<typeof createSchemaRegistry>;
}): JsonSchemaObject | undefined {
  if (params.schema === undefined) {
    return undefined;
  }

  const objectSchema = unwrapObjectSchema(params.schema);
  if (objectSchema === undefined) {
    return undefined;
  }

  const converted = params.registry.convertInline({
    schema: objectSchema,
    location: params.location,
  });
  const propertySchemas = getObjectPropertySchemas(converted);
  const requiredProperties = new Set(getRequiredPropertyNames(converted));

  return Object.fromEntries(
    Object.entries(propertySchemas).map(([name, schema]) => {
      return [
        name,
        {
          required: requiredProperties.has(name),
          schema,
        },
      ];
    })
  );
}

function getResponseStatusCode(
  responseUsage: NormalizedResponseUsage,
  canonicalResponsesByName: ReadonlyMap<string, NormalizedResponse>
): string {
  return String(
    resolveResponse(responseUsage, canonicalResponsesByName).statusCode
  );
}

function unwrapObjectSchema(schema: $ZodType): $ZodObject | undefined {
  let currentSchema: $ZodType | undefined = schema;

  while (currentSchema !== undefined) {
    const type = getSchemaType(currentSchema);
    if (type === "object") {
      return currentSchema as $ZodObject;
    }

    if (
      type === "optional" ||
      type === "nullable" ||
      type === "default" ||
      type === "catch" ||
      type === "readonly" ||
      type === "nonoptional"
    ) {
      currentSchema = (
        currentSchema._zod.def as { readonly innerType?: $ZodType }
      ).innerType;
      continue;
    }

    return undefined;
  }

  return undefined;
}

function getObjectPropertySchemas(
  schema: JsonSchemaObject
): Record<string, JsonSchemaObject> {
  const properties = schema.properties;
  if (
    properties === undefined ||
    typeof properties !== "object" ||
    Array.isArray(properties)
  ) {
    return {};
  }

  return properties as Record<string, JsonSchemaObject>;
}

function getRequiredPropertyNames(schema: JsonSchemaObject): string[] {
  const required = schema.required;
  if (!Array.isArray(required)) {
    return [];
  }

  return required.filter((entry): entry is string => typeof entry === "string");
}

function resolveInfo(
  config: OpenApiPluginConfig | undefined
): JsonSchemaObject {
  return omitUndefinedEntries({
    title: config?.info?.title ?? DEFAULT_INFO.title,
    version: config?.info?.version ?? DEFAULT_INFO.version,
    description: config?.info?.description,
  });
}

function omitUndefinedEntries(
  schema: Record<string, unknown>
): JsonSchemaObject {
  return Object.fromEntries(
    Object.entries(schema).filter(([, value]) => value !== undefined)
  ) as JsonSchemaObject;
}
