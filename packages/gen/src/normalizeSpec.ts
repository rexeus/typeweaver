import {
  DuplicateResponseNameError,
  HttpResponseDefinition,
  HttpStatusCodeNameMap,
  isNamedResponseDefinition,
} from "@rexeus/typeweaver-core";
import type {
  RequestDefinition,
  ResourceDefinition,
  ResponseDefinition,
  SpecDefinition,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import type {
  NormalizedOperation,
  NormalizedRequest,
  NormalizedResponse,
  NormalizedResponseUsage,
  NormalizedSpec,
} from "./NormalizedSpec";

export class EmptySpecResourcesError extends Error {
  public constructor() {
    super("Spec definition must contain at least one resource.");
    this.name = "EmptySpecResourcesError";
  }
}

export class EmptyResourceOperationsError extends Error {
  public constructor(resourceName: string) {
    super(`Resource '${resourceName}' must contain at least one operation.`);
    this.name = "EmptyResourceOperationsError";
  }
}

export class DuplicateOperationIdError extends Error {
  public constructor(operationId: string) {
    super(
      `Operation ID '${operationId}' must be globally unique within a spec.`
    );
    this.name = "DuplicateOperationIdError";
  }
}

export class DuplicateRouteError extends Error {
  public constructor(method: string, path: string, normalizedPath: string) {
    super(
      `Route '${method} ${path}' conflicts with an existing route using normalized path '${normalizedPath}'.`
    );
    this.name = "DuplicateRouteError";
  }
}

export class InvalidRequestSchemaError extends Error {
  public constructor(
    operationId: string,
    requestPart: keyof NormalizedRequest
  ) {
    super(
      `Operation '${operationId}' has an invalid request.${requestPart} schema definition.`
    );
    this.name = "InvalidRequestSchemaError";
  }
}

export class PathParameterMismatchError extends Error {
  public constructor(
    operationId: string,
    path: string,
    pathParams: readonly string[],
    requestParams: readonly string[]
  ) {
    super(
      `Operation '${operationId}' has mismatched path parameters for '${path}'. Path params: [${pathParams.join(
        ", "
      )}], request.param keys: [${requestParams.join(", ")}].`
    );
    this.name = "PathParameterMismatchError";
  }
}

export class DerivedResponseCycleError extends Error {
  public constructor(responseName: string) {
    super(`Derived response '${responseName}' contains a cyclic lineage.`);
    this.name = "DerivedResponseCycleError";
  }
}

export class InvalidDerivedResponseError extends Error {
  public constructor(responseName: string) {
    super(
      `Derived response '${responseName}' contains invalid lineage metadata.`
    );
    this.name = "InvalidDerivedResponseError";
  }
}

export class MissingDerivedResponseParentError extends Error {
  public constructor(responseName: string, parentName: string) {
    super(
      `Derived response '${responseName}' references missing canonical parent '${parentName}'.`
    );
    this.name = "MissingDerivedResponseParentError";
  }
}

const PATH_PARAMETER_PATTERN = /:([A-Za-z0-9_]+)/g;

const normalizeRoutePath = (path: string): string => {
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) {
    return "/";
  }

  return `/${segments.map(segment => (segment.startsWith(":") ? ":" : segment)).join("/")}`;
};

const getPathParameterNames = (path: string): string[] => {
  return Array.from(
    path.matchAll(PATH_PARAMETER_PATTERN),
    match => match[1] as string
  );
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

const normalizeResponseDefinition = (
  response: ResponseDefinition
): NormalizedResponse => {
  return {
    name: response.name,
    statusCode: response.statusCode,
    statusCodeName: HttpStatusCodeNameMap[response.statusCode],
    description: response.description,
    header: response.header,
    body: response.body,
    kind: response.derived === undefined ? "response" : "derived-response",
    derivedFrom: response.derived?.parentName,
    lineage: response.derived?.lineage,
    depth: response.derived?.depth,
  };
};

const isCanonicalResponseDefinition = (
  response: ResponseDefinition
): boolean => {
  return (
    isNamedResponseDefinition(response) ||
    response instanceof HttpResponseDefinition
  );
};

const validateDerivedResponseMetadata = (
  response: ResponseDefinition
): void => {
  const derived = response.derived;

  if (derived === undefined) {
    return;
  }

  if (derived.parentName === response.name) {
    throw new DerivedResponseCycleError(response.name);
  }

  if (derived.lineage.length === 0) {
    throw new InvalidDerivedResponseError(response.name);
  }

  if (derived.lineage.at(-1) !== response.name) {
    throw new InvalidDerivedResponseError(response.name);
  }

  if (derived.lineage.length !== derived.depth) {
    throw new InvalidDerivedResponseError(response.name);
  }

  if (new Set(derived.lineage).size !== derived.lineage.length) {
    throw new DerivedResponseCycleError(response.name);
  }

  if (derived.depth > 1 && derived.lineage.at(-2) !== derived.parentName) {
    throw new InvalidDerivedResponseError(response.name);
  }
};

const validateUniqueResponseNames = (definition: SpecDefinition): void => {
  const responsesByName = new Map<string, ResponseDefinition>();

  for (const resource of Object.values(definition.resources)) {
    for (const operation of resource.operations) {
      for (const response of operation.responses) {
        const existingResponse = responsesByName.get(response.name);

        if (existingResponse !== undefined && existingResponse !== response) {
          throw new DuplicateResponseNameError(response.name);
        }

        responsesByName.set(response.name, response);
      }
    }
  }
};

const collectCanonicalResponseDefinitions = (
  definition: SpecDefinition
): Map<string, ResponseDefinition> => {
  const canonicalResponses = new Map<string, ResponseDefinition>();

  for (const resource of Object.values(definition.resources)) {
    for (const operation of resource.operations) {
      for (const response of operation.responses) {
        if (!isCanonicalResponseDefinition(response)) {
          continue;
        }

        validateDerivedResponseMetadata(response);

        canonicalResponses.set(response.name, response);
      }
    }
  }

  return canonicalResponses;
};

const getDerivedResponseChain = (
  response: ResponseDefinition,
  canonicalResponses: ReadonlyMap<string, ResponseDefinition>
): readonly string[] => {
  const chain: string[] = [response.name];
  const visitedResponseNames = new Set(chain);
  let parentName = response.derived?.parentName;

  while (parentName !== undefined) {
    if (visitedResponseNames.has(parentName)) {
      throw new DerivedResponseCycleError(response.name);
    }

    const parentResponse = canonicalResponses.get(parentName);

    if (parentResponse === undefined) {
      throw new MissingDerivedResponseParentError(response.name, parentName);
    }

    chain.unshift(parentResponse.name);
    visitedResponseNames.add(parentResponse.name);
    parentName = parentResponse.derived?.parentName;
  }

  return chain;
};

const validateDerivedResponseGraph = (
  canonicalResponses: ReadonlyMap<string, ResponseDefinition>
): void => {
  for (const response of canonicalResponses.values()) {
    if (response.derived === undefined) {
      continue;
    }

    const chain = getDerivedResponseChain(response, canonicalResponses);
    const materializedLineage = chain.slice(1);

    if (response.derived.depth !== materializedLineage.length) {
      throw new InvalidDerivedResponseError(response.name);
    }

    if (
      materializedLineage.length !== response.derived.lineage.length ||
      materializedLineage.some(
        (lineageEntry, index) =>
          lineageEntry !== response.derived?.lineage[index]
      )
    ) {
      throw new InvalidDerivedResponseError(response.name);
    }
  }
};

const collectCanonicalResponses = (
  definition: SpecDefinition
): Map<string, NormalizedResponse> => {
  const canonicalResponseDefinitions =
    collectCanonicalResponseDefinitions(definition);

  validateDerivedResponseGraph(canonicalResponseDefinitions);

  return new Map(
    Array.from(
      canonicalResponseDefinitions.entries(),
      ([responseName, response]) => [
        responseName,
        normalizeResponseDefinition(response),
      ]
    )
  );
};

const normalizeOperationResponses = (
  responses: readonly ResponseDefinition[]
): NormalizedResponseUsage[] => {
  return responses.map(response => {
    if (isCanonicalResponseDefinition(response)) {
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

  validateUniqueResponseNames(definition);
  const canonicalResponses = collectCanonicalResponses(definition);
  const operationIds = new Set<string>();
  const routeKeys = new Set<string>();

  return {
    resources: resourceEntries.map(([resourceName, resource]) => {
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
