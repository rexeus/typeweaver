import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import { jsonPointer } from "./internal/jsonPointer.js";
import { toOpenApiPath } from "./internal/openApiPath.js";
import { buildRequestParameters } from "./internal/parameters.js";
import {
  buildComponentsResponses,
  buildOperationResponses,
} from "./internal/responses.js";
import {
  convertSchema,
  unwrapRootOptional,
} from "./internal/schemaConversion.js";
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
  const canonicalResponses = buildComponentsResponses(normalizedSpec.responses);
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
      });

      paths[openApiPath] = {
        ...paths[openApiPath],
        [method]: operationObject.operation,
      };
      warnings.push(...operationObject.warnings);
    }
  }

  const document: OpenApiDocument = {
    openapi: "3.1.1",
    info: { ...options.info },
    ...(options.servers === undefined ? {} : { servers: [...options.servers] }),
    tags: normalizedSpec.resources.map(resource => ({ name: resource.name })),
    paths,
    ...(normalizedSpec.responses.length === 0
      ? {}
      : { components: { responses: canonicalResponses.responses } }),
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
  const requestBody = buildRequestBody(context);
  const responses = buildOperationResponses(
    options.operation.responses,
    options.canonicalResponsesByName,
    context
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

function buildRequestBody(context: {
  readonly resourceName: string;
  readonly operation: NormalizedSpec["resources"][number]["operations"][number];
  readonly openApiPath: string;
  readonly method: OpenApiHttpMethod;
}): {
  readonly requestBody?: OpenApiRequestBodyObject;
  readonly warnings: readonly OpenApiBuildWarning[];
} {
  const body = context.operation.request?.body;

  if (body === undefined) {
    return { warnings: [] };
  }

  const schemaPointer = jsonPointer([
    "paths",
    context.openApiPath,
    context.method,
    "requestBody",
    "content",
    "application/json",
    "schema",
  ]);
  const optionalSchema = unwrapRootOptional(body);
  const converted = convertSchema(optionalSchema.schema, schemaPointer, {
    resourceName: context.resourceName,
    operationId: context.operation.operationId,
    method: context.operation.method,
    path: context.operation.path,
    openApiPath: context.openApiPath,
    part: "request.body",
  });

  return {
    requestBody: {
      required: !optionalSchema.isOptional,
      content: {
        "application/json": {
          schema: converted.schema,
        },
      },
    },
    warnings: converted.warnings,
  };
}
