import {
  DuplicateResponseNameError as CoreDuplicateResponseNameError,
  validateUniqueResponseNames,
} from "@rexeus/typeweaver-core";
import type {
  ResourceDefinition,
  SpecDefinition,
} from "@rexeus/typeweaver-core";
import { Effect } from "effect";
import {
  normalizeContractRoot,
  normalizeOperationContract,
  normalizeResourceContract,
} from "./contractNormalization.js";
import {
  DuplicateOperationIdError,
  DuplicateResponseNameError,
  DuplicateRouteError,
  EmptyOperationResponsesError,
  EmptyResourceOperationsError,
  EmptySpecResourcesError,
  InvalidOperationIdError,
  InvalidResourceNameError,
  isNormalizationError,
} from "./errors/index.js";
import {
  isSupportedOperationId,
  isSupportedResourceName,
} from "./helpers/namingUtils.js";
import { normalizeRoutePath } from "./helpers/routePath.js";
import {
  normalizeOperationResponses,
  validateRequest,
} from "./requestNormalization.js";
import { collectCanonicalResponses } from "./validation/index.js";
import type { NormalizedResourceContract } from "./contractNormalization.js";
import type { NormalizationError } from "./errors/index.js";
import type {
  NormalizedOperation,
  NormalizedSpec,
  NormalizedSpecWarning,
} from "./NormalizedSpec.js";
type NormalizeOperationResult = {
  readonly operation: NormalizedOperation;
  readonly warnings: readonly NormalizedSpecWarning[];
};
type OperationNormalizationContext = {
  readonly resourceName: string;
  readonly resourceContract: NormalizedResourceContract;
  readonly contractRoot: ReturnType<typeof normalizeContractRoot>;
  readonly operationIds: Set<string>;
  readonly routeKeys: Set<string>;
};
const registerOperationIdentity = (
  context: OperationNormalizationContext,
  operation: ResourceDefinition["operations"][number]
): void => {
  if (!isSupportedOperationId(operation.operationId))
    throw new InvalidOperationIdError({ operationId: operation.operationId });
  if (context.operationIds.has(operation.operationId))
    throw new DuplicateOperationIdError({ operationId: operation.operationId });
  context.operationIds.add(operation.operationId);
  const normalizedPath = normalizeRoutePath(operation.path);
  const routeKey = `${operation.method}:${normalizedPath}`;
  if (context.routeKeys.has(routeKey))
    throw new DuplicateRouteError({
      method: operation.method,
      path: operation.path,
      normalizedPath,
    });
  context.routeKeys.add(routeKey);
  if (operation.responses.length === 0)
    throw new EmptyOperationResponsesError({
      operationId: operation.operationId,
    });
};
const normalizeOperation = (
  context: OperationNormalizationContext,
  operation: ResourceDefinition["operations"][number]
): NormalizeOperationResult => {
  const { resourceName, resourceContract, contractRoot } = context;
  registerOperationIdentity(context, operation);
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
  const contract = normalizeOperationContract(
    resourceName,
    resourceContract,
    operation,
    contractRoot
  );
  return {
    operation: {
      operationId: operation.operationId,
      method: operation.method,
      path: operation.path,
      summary: operation.summary,
      description: contract.description,
      deprecated: contract.deprecated,
      tags: contract.tags,
      security: contract.security,
      request: request.request,
      responses: responses.responses,
    },
    warnings: [...request.warnings, ...responses.warnings],
  };
};
const normalizeSpecSync = (definition: SpecDefinition): NormalizedSpec => {
  const resourceEntries = Object.entries(definition.resources);
  if (resourceEntries.length === 0) throw new EmptySpecResourcesError();
  const contractRoot = normalizeContractRoot(definition);
  // The core validator throws a plain Error (the core package stays free of
  // an effect dependency — the same error fires from `defineSpec` in user
  // authoring code). Wrap it here so the `NormalizationError` union stays a
  // homogeneous set of tagged errors.
  try {
    validateUniqueResponseNames(definition.resources);
  } catch (error) {
    if (error instanceof CoreDuplicateResponseNameError)
      throw new DuplicateResponseNameError({
        responseName: error.responseName,
      });
    throw error;
  }
  const canonicalResponses = collectCanonicalResponses(definition);
  const operationIds = new Set<string>();
  const routeKeys = new Set<string>();
  const warnings: NormalizedSpecWarning[] = [...canonicalResponses.warnings];
  return {
    metadata: contractRoot.metadata,
    securitySchemes: contractRoot.securitySchemes,
    security: contractRoot.security,
    resources: resourceEntries.map(([resourceName, resource]) => {
      if (!isSupportedResourceName(resourceName))
        throw new InvalidResourceNameError({ resourceName });
      if (resource.operations.length === 0)
        throw new EmptyResourceOperationsError({ resourceName });
      const resourceContract = normalizeResourceContract(
        resourceName,
        resource,
        contractRoot
      );
      const operationContext: OperationNormalizationContext = {
        resourceName,
        resourceContract,
        contractRoot,
        operationIds,
        routeKeys,
      };
      return {
        name: resourceName,
        description: resourceContract.description,
        tags: resourceContract.tags,
        security: resourceContract.security,
        operations: resource.operations.map(operation => {
          const normalized = normalizeOperation(operationContext, operation);
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
      if (isNormalizationError(error)) return error;
      // Anything else (programming bug, unexpected throw) propagates as a
      // defect rather than getting falsely stamped as a NormalizationError.
      throw error;
    },
  });
