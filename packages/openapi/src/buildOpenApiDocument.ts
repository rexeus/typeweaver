import type {
  NormalizedResponse,
  NormalizedSpec,
} from "@rexeus/typeweaver-gen";
import { resolveOpenApiBodySchema } from "./internal/bodyContent.js";
import { assembleOpenApiDocument } from "./internal/document.js";
import { jsonPointer } from "./internal/jsonPointer.js";
import { toOpenApiPath } from "./internal/openApiPath.js";
import { buildRequestParameters } from "./internal/parameters.js";
import {
  buildComponentsResponses,
  buildOperationResponses,
} from "./internal/responses.js";
import { unwrapRootOptional } from "./internal/schemaConversion.js";
import {
  createSchemaRegistry,
  requestBodyComponentName,
} from "./internal/schemaRegistry.js";
import type { SchemaRegistry } from "./internal/schemaRegistry.js";
import type {
  BuildOpenApiDocumentOptions,
  OpenApiBuildResult,
  OpenApiBuildWarning,
  OpenApiDiagnosticWarning,
  OpenApiHttpMethod,
  OpenApiOperationObject,
  OpenApiPathsObject,
  OpenApiRequestBodyObject,
} from "./types.js";

export function buildOpenApiDocument(
  normalizedSpec: NormalizedSpec,
  options: BuildOpenApiDocumentOptions = {}
): OpenApiBuildResult {
  const warnings: OpenApiBuildWarning[] = [
    ...duplicateCanonicalResponseWarnings(normalizedSpec.responses),
    ...resourceDescriptionWarnings(normalizedSpec.resources),
  ];
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
  const document = assembleOpenApiDocument(normalizedSpec, options, {
    paths,
    responses,
    schemas,
  });

  return { document, warnings };
}

function resourceDescriptionWarnings(
  resources: NormalizedSpec["resources"]
): readonly OpenApiDiagnosticWarning[] {
  const warnings: OpenApiDiagnosticWarning[] = [];
  for (const resource of resources) {
    if (resource.description !== undefined) {
      warnings.push({
        origin: "openapi-builder",
        code: "unrepresentable-resource-description",
        message: `Resource '${resource.name}' description cannot be projected losslessly because one resource may span multiple OpenAPI paths.`,
        documentPath: "/paths",
        location: { resourceName: resource.name, part: "resource.description" },
      });
    }
  }
  return warnings;
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
      ...(options.operation.description === undefined
        ? {}
        : { description: options.operation.description }),
      ...(options.operation.deprecated ? { deprecated: true } : {}),
      tags: [...options.operation.tags],
      ...(parameters.parameters.length === 0
        ? {}
        : { parameters: parameters.parameters }),
      ...(requestBody.requestBody === undefined
        ? {}
        : { requestBody: requestBody.requestBody }),
      responses: responses.responses,
      ...(options.operation.security.source === "none"
        ? {}
        : { security: options.operation.security.requirements }),
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

  const optionalSchema = unwrapRootOptional(body.schema);
  const resolvedSchema = resolveOpenApiBodySchema<OpenApiBuildWarning>(
    body,
    () => {
      const registration = schemaRegistry.register({
        schema: optionalSchema.schema,
        baseName: requestBodyComponentName(context.operation.operationId),
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
        schema: registration.ref,
        schemaKey: registration.ref.$ref,
        warnings: registration.warnings,
      };
    }
  );

  return {
    requestBody: {
      required: !optionalSchema.isOptional,
      content: {
        [body.mediaType]: {
          schema: resolvedSchema.schema,
        },
      },
    },
    warnings: resolvedSchema.warnings,
  };
}

function duplicateCanonicalResponseWarnings(
  responses: readonly NormalizedResponse[]
): readonly OpenApiDiagnosticWarning[] {
  const firstSeenAt = new Map<string, number>();
  const warnings: OpenApiDiagnosticWarning[] = [];

  responses.forEach((response, index) => {
    const previousIndex = firstSeenAt.get(response.name);

    if (previousIndex === undefined) {
      firstSeenAt.set(response.name, index);
      return;
    }

    warnings.push({
      origin: "openapi-builder",
      code: "duplicate-canonical-response",
      message: `Canonical response '${response.name}' is defined more than once; the entry at index ${index} overrides the entry at index ${previousIndex}.`,
      documentPath: jsonPointer(["components", "responses", response.name]),
      location: { responseName: response.name, part: "components.responses" },
    });
  });

  return warnings;
}
