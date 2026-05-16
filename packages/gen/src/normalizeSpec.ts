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
import { Effect } from "effect";
import { z } from "zod";
import { normalizeBody } from "./bodyNormalization.js";
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
} from "./errors/index.js";
import { isNormalizationError } from "./errors/NormalizationError.js";
import {
  isSupportedOperationId,
  isSupportedResourceName,
} from "./helpers/namingUtils.js";
import {
  getPathParameterNames,
  normalizeRoutePath,
} from "./helpers/routePath.js";
import {
  collectCanonicalResponses,
  normalizeResponseDefinition,
} from "./validation/index.js";
import type { NormalizationError } from "./errors/NormalizationError.js";
import type {
  NormalizedOperation,
  NormalizedRequest,
  NormalizedResponseUsage,
  NormalizedSpec,
  NormalizedSpecWarning,
} from "./NormalizedSpec.js";

type ValidateRequestResult = {
  readonly request?: NormalizedRequest;
  readonly warnings: readonly NormalizedSpecWarning[];
};

type NormalizeOperationResponsesResult = {
  readonly responses: readonly NormalizedResponseUsage[];
  readonly warnings: readonly NormalizedSpecWarning[];
};

type NormalizeOperationResult = {
  readonly operation: NormalizedOperation;
  readonly warnings: readonly NormalizedSpecWarning[];
};

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
    throw new InvalidRequestSchemaError({ operationId, requestPart });
  }

  if (requestPart === "param" && !isZodObject(schema)) {
    throw new InvalidRequestSchemaError({ operationId, requestPart });
  }
};

const validateRequest = (
  resourceName: string,
  operationId: string,
  path: string,
  request: RequestDefinition
): ValidateRequestResult => {
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
    throw new PathParameterMismatchError({
      operationId,
      path,
      pathParams,
      requestParams,
    });
  }

  if (
    request.header === undefined &&
    request.param === undefined &&
    request.query === undefined &&
    request.body === undefined
  ) {
    return { warnings: [] };
  }

  const body = normalizeBody({
    bodySchema: request.body,
    headerSchema: request.header,
    location: { resourceName, operationId, part: "request.body" },
  });

  return {
    request: {
      header: request.header,
      param: request.param,
      query: request.query,
      body: body.body,
    },
    warnings: body.warnings,
  };
};

const normalizeOperationResponses = (
  resourceName: string,
  operationId: string,
  responses: readonly ResponseDefinition[]
): NormalizeOperationResponsesResult => {
  const warnings: NormalizedSpecWarning[] = [];
  const normalizedResponses = responses.map(response => {
    if (isNamedResponseDefinition(response)) {
      return {
        responseName: response.name,
        source: "canonical",
      } satisfies NormalizedResponseUsage;
    }

    const normalized = normalizeResponseDefinition(response, {
      resourceName,
      operationId,
      responseName: response.name,
      statusCode: response.statusCode,
    });

    warnings.push(...normalized.warnings);

    return {
      responseName: response.name,
      source: "inline",
      response: normalized.response,
    } satisfies NormalizedResponseUsage;
  });

  return { responses: normalizedResponses, warnings };
};

const normalizeOperation = (
  resourceName: string,
  operationIds: Set<string>,
  routeKeys: Set<string>,
  operation: ResourceDefinition["operations"][number]
): NormalizeOperationResult => {
  if (!isSupportedOperationId(operation.operationId)) {
    throw new InvalidOperationIdError({ operationId: operation.operationId });
  }

  if (operationIds.has(operation.operationId)) {
    throw new DuplicateOperationIdError({
      operationId: operation.operationId,
    });
  }

  operationIds.add(operation.operationId);

  const normalizedPath = normalizeRoutePath(operation.path);
  const routeKey = `${operation.method}:${normalizedPath}`;

  if (routeKeys.has(routeKey)) {
    throw new DuplicateRouteError({
      method: operation.method,
      path: operation.path,
      normalizedPath,
    });
  }

  routeKeys.add(routeKey);

  if (operation.responses.length === 0) {
    throw new EmptyOperationResponsesError({
      operationId: operation.operationId,
    });
  }

  const request = validateRequest(
    resourceName,
    operation.operationId,
    operation.path,
    operation.request
  );
  const responses = normalizeOperationResponses(
    resourceName,
    operation.operationId,
    operation.responses
  );

  return {
    operation: {
      operationId: operation.operationId,
      method: operation.method,
      path: operation.path,
      summary: operation.summary,
      request: request.request,
      responses: responses.responses,
    },
    warnings: [...request.warnings, ...responses.warnings],
  };
};

const normalizeSpecSync = (definition: SpecDefinition): NormalizedSpec => {
  const resourceEntries = Object.entries(definition.resources);

  if (resourceEntries.length === 0) {
    throw new EmptySpecResourcesError();
  }

  validateUniqueResponseNames(definition.resources);
  const canonicalResponses = collectCanonicalResponses(definition);
  const operationIds = new Set<string>();
  const routeKeys = new Set<string>();
  const warnings: NormalizedSpecWarning[] = [...canonicalResponses.warnings];

  return {
    resources: resourceEntries.map(([resourceName, resource]) => {
      if (!isSupportedResourceName(resourceName)) {
        throw new InvalidResourceNameError({ resourceName });
      }

      if (resource.operations.length === 0) {
        throw new EmptyResourceOperationsError({ resourceName });
      }

      return {
        name: resourceName,
        operations: resource.operations.map(operation => {
          const normalized = normalizeOperation(
            resourceName,
            operationIds,
            routeKeys,
            operation
          );

          warnings.push(...normalized.warnings);

          return normalized.operation;
        }),
      };
    }),
    responses: Array.from(canonicalResponses.responses.values()),
    warnings,
  };
};

/**
 * Normalize a SpecDefinition into the internal model used by every plugin.
 *
 * Internally a pure synchronous transform; exposed as an Effect so callers
 * can compose with the rest of the pipeline, recover specific failures via
 * `Effect.catchTag`, and stay type-aware of the closed set of normalization
 * errors via the `NormalizationError` union.
 */
export const normalizeSpec = (
  definition: SpecDefinition
): Effect.Effect<NormalizedSpec, NormalizationError> =>
  Effect.try({
    try: () => normalizeSpecSync(definition),
    catch: error => {
      if (isNormalizationError(error)) {
        return error;
      }
      // Anything else (programming bug, unexpected throw) propagates as a
      // defect rather than getting falsely stamped as a NormalizationError.
      throw error;
    },
  });
