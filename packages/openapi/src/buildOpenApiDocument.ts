import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import { pascalCase } from "polycase";
import { toOpenApiPath } from "./internal/openApiPath.js";
import { buildRequestParameters } from "./internal/parameters.js";
import {
  buildComponentsResponses,
  buildOperationResponses,
} from "./internal/responses.js";
import { unwrapRootOptional } from "./internal/schemaConversion.js";
import { createSchemaRegistry } from "./internal/schemaRegistry.js";
import type { SchemaRegistry } from "./internal/schemaRegistry.js";
import type {
  BuildOpenApiDocumentOptions,
  OpenApiBuildResult,
  OpenApiBuildWarning,
  OpenApiDocument,
  OpenApiHttpMethod,
  OpenApiOperationObject,
  OpenApiPathsObject,
  OpenApiRequestBodyObject,
} from "./types.js";

export function buildOpenApiDocument(
  normalizedSpec: NormalizedSpec,
  options: BuildOpenApiDocumentOptions
): OpenApiBuildResult {
  const warnings: OpenApiBuildWarning[] = [];
  const schemaRegistry = createSchemaRegistry();
  const canonicalResponses = buildComponentsResponses(
    normalizedSpec.responses,
    schemaRegistry
  );
  const canonicalResponsesByName = new Map(
    normalizedSpec.responses.map(response => [response.name, response])
  );
  const paths: OpenApiPathsObject = {};

  warnings.push(...canonicalResponses.warnings);

  for (const resource of normalizedSpec.resources) {
    for (const operation of resource.operations) {
      const method = operation.method.toLowerCase() as OpenApiHttpMethod;
      const openApiPath = toOpenApiPath(operation.path);
      const operationObject = buildOperationObject({
        resourceName: resource.name,
        operation,
        openApiPath,
        method,
        canonicalResponsesByName,
        schemaRegistry,
      });

      paths[openApiPath] = {
        ...paths[openApiPath],
        [method]: operationObject.operation,
      };
      warnings.push(...operationObject.warnings);
    }
  }

  const schemas = schemaRegistry.components();
  const responses = canonicalResponses.responses;
  const hasResponses = Object.keys(responses).length > 0;
  const hasSchemas = Object.keys(schemas).length > 0;
  const document: OpenApiDocument = {
    openapi: "3.1.1",
    jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
    info: { ...options.info },
    ...(options.servers === undefined ? {} : { servers: [...options.servers] }),
    tags: normalizedSpec.resources.map(resource => ({ name: resource.name })),
    paths,
    ...(!hasResponses && !hasSchemas
      ? {}
      : {
          components: {
            ...(hasResponses ? { responses } : {}),
            ...(hasSchemas ? { schemas } : {}),
          },
        }),
  };

  return { document, warnings };
}

function buildOperationObject(options: {
  readonly resourceName: string;
  readonly operation: NormalizedSpec["resources"][number]["operations"][number];
  readonly openApiPath: string;
  readonly method: OpenApiHttpMethod;
  readonly canonicalResponsesByName: ReadonlyMap<
    string,
    NormalizedSpec["responses"][number]
  >;
  readonly schemaRegistry: SchemaRegistry;
}): {
  readonly operation: OpenApiOperationObject;
  readonly warnings: readonly OpenApiBuildWarning[];
} {
  const context = {
    resourceName: options.resourceName,
    operation: options.operation,
    openApiPath: options.openApiPath,
    method: options.method,
  };
  const parameters = buildRequestParameters(context);
  const requestBody = buildRequestBody(context, options.schemaRegistry);
  const responses = buildOperationResponses(
    options.operation.responses,
    options.canonicalResponsesByName,
    context,
    options.schemaRegistry
  );

  return {
    operation: {
      operationId: options.operation.operationId,
      ...(options.operation.summary.trim() === ""
        ? {}
        : { summary: options.operation.summary }),
      tags: [options.resourceName],
      ...(parameters.parameters.length === 0
        ? {}
        : { parameters: parameters.parameters }),
      ...(requestBody.requestBody === undefined
        ? {}
        : { requestBody: requestBody.requestBody }),
      responses: responses.responses,
    },
    warnings: [
      ...parameters.warnings,
      ...requestBody.warnings,
      ...responses.warnings,
    ],
  };
}

function buildRequestBody(
  context: {
    readonly resourceName: string;
    readonly operation: NormalizedSpec["resources"][number]["operations"][number];
    readonly openApiPath: string;
    readonly method: OpenApiHttpMethod;
  },
  schemaRegistry: SchemaRegistry
): {
  readonly requestBody?: OpenApiRequestBodyObject;
  readonly warnings: readonly OpenApiBuildWarning[];
} {
  const body = context.operation.request?.body;

  if (body === undefined) {
    return { warnings: [] };
  }

  const optionalSchema = unwrapRootOptional(body);
  const registration = schemaRegistry.register({
    schema: optionalSchema.schema,
    baseName: `${pascalCase(context.operation.operationId)}RequestBody`,
    location: {
      resourceName: context.resourceName,
      operationId: context.operation.operationId,
      method: context.operation.method,
      path: context.operation.path,
      openApiPath: context.openApiPath,
      part: "request.body",
    },
  });

  return {
    requestBody: {
      required: !optionalSchema.isOptional,
      content: {
        "application/json": {
          schema: registration.ref,
        },
      },
    },
    warnings: registration.warnings,
  };
}
