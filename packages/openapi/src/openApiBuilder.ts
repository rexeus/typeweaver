import { toPascalCase } from "@rexeus/typeweaver-gen";
import type {
  NormalizedOperation,
  NormalizedRequest,
  NormalizedResponse,
  NormalizedResponseUsage,
} from "@rexeus/typeweaver-gen";
import type { $ZodObject, $ZodType } from "zod/v4/core";
import { createSchemaRegistry } from "./schemaRegistry.js";
import type { OpenApiBuildResult, OpenApiBuilderInput, OpenApiPluginConfig } from "./types.js";

type JsonSchemaObject = Record<string, unknown>;
type OpenApiParameters = readonly JsonSchemaObject[];

const JSON_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";
const DEFAULT_INFO = {
  title: "Typeweaver API",
  version: "0.0.0",
} as const;

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
    responses: Object.fromEntries(
      params.operation.responses.map(responseUsage => {
        return [
          getResponseStatusCode(responseUsage, params.canonicalResponsesByName),
          buildResponseUsageObject({
            resourceName: params.resourceName,
            operation: params.operation,
            responseUsage,
            canonicalResponsesByName: params.canonicalResponsesByName,
            registry: params.registry,
          }),
        ];
      })
    ),
  });
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
  if (responseUsage.source === "inline") {
    return String(responseUsage.response.statusCode);
  }

  const response = canonicalResponsesByName.get(responseUsage.responseName);
  if (response === undefined) {
    throw new Error(`Missing canonical response '${responseUsage.responseName}'.`);
  }

  return String(response.statusCode);
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
      currentSchema = (currentSchema._zod.def as { readonly innerType?: $ZodType }).innerType;
      continue;
    }

    return undefined;
  }

  return undefined;
}

function getSchemaType(schema: $ZodType): string {
  return (schema._zod.def as { readonly type?: string }).type ?? "unknown";
}

function getObjectPropertySchemas(schema: JsonSchemaObject): Record<string, JsonSchemaObject> {
  const properties = schema.properties;
  if (properties === undefined || typeof properties !== "object" || Array.isArray(properties)) {
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

function resolveInfo(config: OpenApiPluginConfig | undefined): JsonSchemaObject {
  return omitUndefinedEntries({
    title: config?.info?.title ?? DEFAULT_INFO.title,
    version: config?.info?.version ?? DEFAULT_INFO.version,
    description: config?.info?.description,
  });
}

function omitUndefinedEntries(schema: Record<string, unknown>): JsonSchemaObject {
  return Object.fromEntries(
    Object.entries(schema).filter(([, value]) => value !== undefined)
  ) as JsonSchemaObject;
}
