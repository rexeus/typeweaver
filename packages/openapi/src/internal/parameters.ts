import {
  escapeJsonPointerSegment,
  isJsonPointerAtOrBelow,
  jsonPointer,
} from "./jsonPointer.js";
import { getPathParameterNames } from "./openApiPath.js";
import { createOperationLocation } from "./operationContext.js";
import { extractParameterContainer } from "./parameterContainer.js";
import { rebaseLocalJsonSchemaRefs } from "./schemaConversion.js";
import type {
  OpenApiBuildWarning,
  OpenApiDiagnosticWarning,
  OpenApiParameterObject,
} from "../types.js";
import type { OperationContext } from "./operationContext.js";
import type { ParameterContainerResult } from "./parameterContainer.js";
import type { z } from "zod";

export type RequestParameterResult = {
  readonly parameters: readonly OpenApiParameterObject[];
  readonly warnings: readonly OpenApiBuildWarning[];
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

const buildUnusedPathParameterWarnings = (
  context: OperationContext,
  parametersPointer: string,
  containerProperties: ParameterContainerResult["properties"],
  pathNameSet: ReadonlySet<string>
): OpenApiDiagnosticWarning[] =>
  Object.keys(containerProperties)
    .filter(name => !pathNameSet.has(name))
    .map(name =>
      createParameterWarning({
        code: "unused-path-parameter-schema",
        message: `Path parameter schema '${name}' is not used by '${context.operation.path}'.`,
        documentPath: parametersPointer,
        context,
        part: "request.path",
        parameterName: name,
      })
    );

const buildPathParameterObject = (options: {
  readonly context: OperationContext;
  readonly parametersPointer: string;
  readonly name: string;
  readonly index: number;
  readonly schema: ParameterContainerResult["properties"][string] | undefined;
  readonly missingWarnings: OpenApiDiagnosticWarning[];
}): OpenApiParameterObject => {
  const parameterPointer = jsonPointer([
    "paths",
    options.context.openApiPath,
    options.context.method,
    "parameters",
    String(options.index),
  ]);

  if (options.schema === undefined) {
    options.missingWarnings.push(
      createParameterWarning({
        code: "missing-path-parameter-schema",
        message: `Path parameter '${options.name}' is missing a schema.`,
        documentPath: `${parameterPointer}/schema`,
        context: options.context,
        part: "request.path",
        parameterName: options.name,
      })
    );
  }

  return {
    name: options.name,
    in: "path" as const,
    required: true,
    schema:
      options.schema === undefined
        ? {}
        : rebaseLocalJsonSchemaRefs(
            options.schema,
            `${parameterPointer}/schema`
          ),
  };
};

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
  const unusedWarnings = buildUnusedPathParameterWarnings(
    context,
    parametersPointer,
    container.properties,
    pathNameSet
  );
  const parameters = pathNames.map((name, index) =>
    buildPathParameterObject({
      context,
      parametersPointer,
      name,
      index,
      schema: container.properties[name],
      missingWarnings,
    })
  );

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

    if (parameterName === undefined) {
      return warning;
    }

    const schemaPath = `/properties/${escapeJsonPointerSegment(parameterName)}`;
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

function createParameterWarning(options: {
  readonly code: OpenApiDiagnosticWarning["code"];
  readonly message: string;
  readonly documentPath: string;
  readonly context: OperationContext;
  readonly part: string;
  readonly parameterName: string;
}): OpenApiDiagnosticWarning {
  return {
    origin: "openapi-builder",
    code: options.code,
    message: options.message,
    documentPath: options.documentPath,
    location: createOperationLocation(options),
  };
}
