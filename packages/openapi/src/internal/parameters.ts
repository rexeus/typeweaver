import type { NormalizedOperation } from "@rexeus/typeweaver-gen";
import type { JsonSchema } from "@rexeus/typeweaver-zod-to-json-schema";
import {
  escapeJsonPointerSegment,
  isJsonPointerAtOrBelow,
  jsonPointer,
} from "./jsonPointer.js";
import { getPathParameterNames } from "./openApiPath.js";
import {
  convertSchema,
  getObjectProperties,
  getRequiredNames,
  hasUnrepresentableAdditionalProperties,
  preserveReferencedRootDefinitions,
  rebaseLocalJsonSchemaRefs,
  unwrapRootOptional,
} from "./schemaConversion.js";
import type {
  OpenApiBuildWarning,
  OpenApiDiagnosticWarning,
  OpenApiHeaderObject,
  OpenApiParameterObject,
  OpenApiWarningLocation,
} from "../types.js";
import type { z } from "zod";

export type OperationContext = {
  readonly resourceName: string;
  readonly operation: Pick<
    NormalizedOperation,
    "operationId" | "path" | "request"
  > & { readonly method: string };
  readonly openApiPath: string;
  readonly method: string;
};

export type RequestParameterResult = {
  readonly parameters: readonly OpenApiParameterObject[];
  readonly warnings: readonly OpenApiBuildWarning[];
};

export type HeaderObjectResult = {
  readonly headers: Record<string, OpenApiHeaderObject>;
  readonly warnings: readonly OpenApiBuildWarning[];
};

type ParameterContainerResult = {
  readonly properties: Record<string, JsonSchema>;
  readonly requiredNames: ReadonlySet<string>;
  readonly warnings: readonly OpenApiBuildWarning[];
  readonly isRootOptional: boolean;
};

export function buildRequestParameters(
  context: OperationContext
): RequestParameterResult {
  const operationPointer = jsonPointer([
    "paths",
    context.openApiPath,
    context.method,
    "parameters",
  ]);
  const pathParameters = buildPathParameters(context, operationPointer);
  const queryParameters = buildParametersFromContainer({
    schema: context.operation.request?.query,
    parameterIn: "query",
    part: "request.query",
    context,
    startIndex: pathParameters.parameters.length,
    parametersPointer: operationPointer,
  });
  const headerParameters = buildParametersFromContainer({
    schema: context.operation.request?.header,
    parameterIn: "header",
    part: "request.header",
    context,
    startIndex:
      pathParameters.parameters.length + queryParameters.parameters.length,
    parametersPointer: operationPointer,
  });
  const parameters = [
    ...pathParameters.parameters,
    ...queryParameters.parameters,
    ...headerParameters.parameters,
  ];

  return {
    parameters,
    warnings: [
      ...pathParameters.warnings,
      ...queryParameters.warnings,
      ...headerParameters.warnings,
    ],
  };
}

export function buildHeaderObjects(
  schema: z.core.$ZodType | undefined,
  context: OperationContext,
  responseContext: {
    readonly responseName?: string;
    readonly statusCode: string;
    readonly part: string;
    readonly headersPointer: string;
  }
): HeaderObjectResult {
  const container = extractParameterContainer({
    schema,
    context,
    part: responseContext.part,
    containerPointer: responseContext.headersPointer,
    responseName: responseContext.responseName,
    statusCode: responseContext.statusCode,
  });
  const headers = Object.fromEntries(
    Object.entries(container.properties).map(([name, headerSchema]) => {
      const headerPointer = `${responseContext.headersPointer}/${escapeJsonPointerSegment(
        name
      )}/schema`;

      return [
        name,
        {
          required:
            !container.isRootOptional && container.requiredNames.has(name),
          schema: rebaseLocalJsonSchemaRefs(headerSchema, headerPointer),
        },
      ];
    })
  );

  return {
    headers,
    warnings: rebaseHeaderSchemaWarnings(
      container.warnings,
      Object.keys(container.properties),
      responseContext.headersPointer
    ),
  };
}

function buildPathParameters(
  context: OperationContext,
  parametersPointer: string
): RequestParameterResult {
  const pathNames = getPathParameterNames(context.operation.path);
  const container = extractParameterContainer({
    schema: context.operation.request?.param,
    context,
    part: "request.path",
    containerPointer: parametersPointer,
  });
  const pathNameSet = new Set(pathNames);
  const missingWarnings: OpenApiDiagnosticWarning[] = [];
  const unusedWarnings = Object.keys(container.properties)
    .filter(name => !pathNameSet.has(name))
    .map(name =>
      createBuilderWarning({
        code: "unused-path-parameter-schema",
        message: `Path parameter schema '${name}' is not used by '${context.operation.path}'.`,
        documentPath: parametersPointer,
        context,
        part: "request.path",
        parameterName: name,
      })
    );
  const parameters = pathNames.map((name, index) => {
    const schema = container.properties[name];
    const parameterPointer = jsonPointer([
      "paths",
      context.openApiPath,
      context.method,
      "parameters",
      String(index),
    ]);

    if (schema === undefined) {
      missingWarnings.push(
        createBuilderWarning({
          code: "missing-path-parameter-schema",
          message: `Path parameter '${name}' is missing a schema.`,
          documentPath: `${parameterPointer}/schema`,
          context,
          part: "request.path",
          parameterName: name,
        })
      );
    }

    return {
      name,
      in: "path" as const,
      required: true,
      schema:
        schema === undefined
          ? {}
          : rebaseLocalJsonSchemaRefs(schema, `${parameterPointer}/schema`),
    };
  });

  return {
    parameters,
    warnings: [
      ...rebaseParameterSchemaWarnings({
        warnings: container.warnings,
        context,
        parameterNames: pathNames,
        startIndex: 0,
      }),
      ...unusedWarnings,
      ...missingWarnings,
    ],
  };
}

function buildParametersFromContainer(options: {
  readonly schema: z.core.$ZodType | undefined;
  readonly parameterIn: "query" | "header";
  readonly part: string;
  readonly context: OperationContext;
  readonly startIndex: number;
  readonly parametersPointer: string;
}): RequestParameterResult {
  const container = extractParameterContainer({
    schema: options.schema,
    context: options.context,
    part: options.part,
    containerPointer: options.parametersPointer,
  });
  const parameters = Object.entries(container.properties).map(
    ([name, schema], index) => ({
      name,
      in: options.parameterIn,
      required: !container.isRootOptional && container.requiredNames.has(name),
      schema: rebaseLocalJsonSchemaRefs(
        schema,
        `${options.parametersPointer}/${options.startIndex + index}/schema`
      ),
    })
  );
  const rebasedWarnings = rebaseParameterSchemaWarnings({
    warnings: container.warnings,
    context: options.context,
    parameterNames: Object.keys(container.properties),
    startIndex: options.startIndex,
  });

  return { parameters, warnings: rebasedWarnings };
}

function extractParameterContainer(options: {
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
  const location = createLocation({
    context: options.context,
    part: options.part,
    responseName: options.responseName,
    statusCode: options.statusCode,
  });
  const converted = convertSchema(
    optionalSchema.schema,
    options.containerPointer,
    location,
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
      createBuilderWarning({
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
      createBuilderWarning({
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
      createBuilderWarning({
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

function rebaseParameterSchemaWarnings(options: {
  readonly warnings: readonly OpenApiBuildWarning[];
  readonly context: OperationContext;
  readonly parameterNames: readonly string[];
  readonly startIndex: number;
}): readonly OpenApiBuildWarning[] {
  return options.warnings.map(warning => {
    if (warning.origin !== "schema-conversion") {
      return warning;
    }

    const parameterIndex = options.parameterNames.findIndex(name =>
      isJsonPointerAtOrBelow(
        warning.schemaPath,
        `/properties/${escapeJsonPointerSegment(name)}`
      )
    );

    if (parameterIndex === -1) {
      return warning;
    }

    const parameterName = options.parameterNames[parameterIndex];
    const schemaPath = `/properties/${escapeJsonPointerSegment(parameterName ?? "")}`;
    const suffix = warning.schemaPath.slice(schemaPath.length);
    const documentPath = `${jsonPointer([
      "paths",
      options.context.openApiPath,
      options.context.method,
      "parameters",
      String(options.startIndex + parameterIndex),
      "schema",
    ])}${suffix}`;

    return {
      ...warning,
      documentPath,
      location: {
        ...warning.location,
        parameterName,
      },
    };
  });
}

function rebaseHeaderSchemaWarnings(
  warnings: readonly OpenApiBuildWarning[],
  headerNames: readonly string[],
  headersPointer: string
): readonly OpenApiBuildWarning[] {
  return warnings.map(warning => {
    if (warning.origin !== "schema-conversion") {
      return warning;
    }

    const headerName = headerNames.find(name =>
      isJsonPointerAtOrBelow(
        warning.schemaPath,
        `/properties/${escapeJsonPointerSegment(name)}`
      )
    );

    if (headerName === undefined) {
      return warning;
    }

    const schemaPath = `/properties/${escapeJsonPointerSegment(headerName)}`;
    const suffix = warning.schemaPath.slice(schemaPath.length);

    return {
      ...warning,
      documentPath: `${headersPointer}/${escapeJsonPointerSegment(
        headerName
      )}/schema${suffix}`,
      location: {
        ...warning.location,
        parameterName: headerName,
      },
    };
  });
}

function createBuilderWarning(options: {
  readonly code: OpenApiDiagnosticWarning["code"];
  readonly message: string;
  readonly documentPath: string;
  readonly context: OperationContext;
  readonly part: string;
  readonly parameterName?: string;
  readonly responseName?: string;
  readonly statusCode?: string;
}): OpenApiDiagnosticWarning {
  return {
    origin: "openapi-builder",
    code: options.code,
    message: options.message,
    documentPath: options.documentPath,
    location: createLocation(options),
  };
}

function createLocation(options: {
  readonly context: OperationContext;
  readonly part: string;
  readonly parameterName?: string;
  readonly responseName?: string;
  readonly statusCode?: string;
}): OpenApiWarningLocation {
  return {
    resourceName: options.context.resourceName,
    operationId: options.context.operation.operationId,
    method: options.context.operation.method,
    path: options.context.operation.path,
    openApiPath: options.context.openApiPath,
    part: options.part,
    parameterName: options.parameterName,
    responseName: options.responseName,
    statusCode: options.statusCode,
  };
}
