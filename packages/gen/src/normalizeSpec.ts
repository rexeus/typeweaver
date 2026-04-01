import {
  isNamedResponseDefinition,
  validateUniqueResponseNames,
} from "@rexeus/typeweaver-core";
import type {
  RequestDefinition,
  ResourceDefinition,
  ResponseDefinition,
  SpecDefinition,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import {
  DuplicateOperationIdError,
  DuplicateRouteError,
  EmptyOperationResponsesError,
  EmptyResourceOperationsError,
  EmptySpecResourcesError,
  InvalidOperationIdError,
  InvalidRequestSchemaError,
  InvalidResourceNameError,
  PathParameterMismatchError,
} from "./errors";
import {
  isSupportedOperationId,
  isSupportedResourceName,
} from "./helpers/namingUtils";
import { getPathParameterNames, normalizeRoutePath } from "./helpers/routePath";
import {
  collectCanonicalResponses,
  normalizeResponseDefinition,
} from "./validation";
import type {
  NormalizedOperation,
  NormalizedRequest,
  NormalizedResponseUsage,
  NormalizedSpec,
} from "./NormalizedSpec";

const isZodType = (schema: unknown): schema is z.ZodType => {
  return schema instanceof z.ZodType;
};

const isZodObject = (
  schema: unknown
): schema is z.ZodObject<z.core.$ZodShape> => {
  return schema instanceof z.ZodObject;
};

const validateRequestSchema = (
  operationId: string,
  requestPart: keyof NormalizedRequest,
  schema: unknown
): void => {
  if (!isZodType(schema)) {
    throw new InvalidRequestSchemaError(operationId, requestPart);
  }

  if (requestPart === "param" && !isZodObject(schema)) {
    throw new InvalidRequestSchemaError(operationId, requestPart);
  }
};

const validateRequest = (
  operationId: string,
  path: string,
  request: RequestDefinition
): NormalizedRequest | undefined => {
  if (request.header !== undefined) {
    validateRequestSchema(operationId, "header", request.header);
  }

  if (request.param !== undefined) {
    validateRequestSchema(operationId, "param", request.param);
  }

  if (request.query !== undefined) {
    validateRequestSchema(operationId, "query", request.query);
  }

  if (request.body !== undefined) {
    validateRequestSchema(operationId, "body", request.body);
  }

  const pathParams = getPathParameterNames(path);
  const requestParams =
    request.param === undefined ? [] : Object.keys(request.param.shape);

  if (
    pathParams.length !== requestParams.length ||
    pathParams.some(pathParam => !requestParams.includes(pathParam))
  ) {
    throw new PathParameterMismatchError(
      operationId,
      path,
      pathParams,
      requestParams
    );
  }

  if (
    request.header === undefined &&
    request.param === undefined &&
    request.query === undefined &&
    request.body === undefined
  ) {
    return undefined;
  }

  return {
    header: request.header,
    param: request.param,
    query: request.query,
    body: request.body,
  };
};

const normalizeOperationResponses = (
  responses: readonly ResponseDefinition[]
): NormalizedResponseUsage[] => {
  return responses.map(response => {
    if (isNamedResponseDefinition(response)) {
      return {
        responseName: response.name,
        source: "canonical",
      };
    }

    return {
      responseName: response.name,
      source: "inline",
      response: normalizeResponseDefinition(response),
    };
  });
};

const normalizeOperation = (
  operationIds: Set<string>,
  routeKeys: Set<string>,
  operation: ResourceDefinition["operations"][number]
): NormalizedOperation => {
  if (!isSupportedOperationId(operation.operationId)) {
    throw new InvalidOperationIdError(operation.operationId);
  }

  if (operationIds.has(operation.operationId)) {
    throw new DuplicateOperationIdError(operation.operationId);
  }

  operationIds.add(operation.operationId);

  const normalizedPath = normalizeRoutePath(operation.path);
  const routeKey = `${operation.method}:${normalizedPath}`;

  if (routeKeys.has(routeKey)) {
    throw new DuplicateRouteError(
      operation.method,
      operation.path,
      normalizedPath
    );
  }

  routeKeys.add(routeKey);

  if (operation.responses.length === 0) {
    throw new EmptyOperationResponsesError(operation.operationId);
  }

  return {
    operationId: operation.operationId,
    method: operation.method,
    path: operation.path,
    summary: operation.summary,
    request: validateRequest(
      operation.operationId,
      operation.path,
      operation.request
    ),
    responses: normalizeOperationResponses(operation.responses),
  };
};

export const normalizeSpec = (definition: SpecDefinition): NormalizedSpec => {
  const resourceEntries = Object.entries(definition.resources);

  if (resourceEntries.length === 0) {
    throw new EmptySpecResourcesError();
  }

  validateUniqueResponseNames(definition.resources);
  const canonicalResponses = collectCanonicalResponses(definition);
  const operationIds = new Set<string>();
  const routeKeys = new Set<string>();

  return {
    resources: resourceEntries.map(([resourceName, resource]) => {
      if (!isSupportedResourceName(resourceName)) {
        throw new InvalidResourceNameError(resourceName);
      }

      if (resource.operations.length === 0) {
        throw new EmptyResourceOperationsError(resourceName);
      }

      return {
        name: resourceName,
        operations: resource.operations.map(operation =>
          normalizeOperation(operationIds, routeKeys, operation)
        ),
      };
    }),
    responses: Array.from(canonicalResponses.values()),
  };
};
