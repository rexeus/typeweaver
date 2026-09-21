import type { NormalizationError } from "../errors/NormalizationError.js";
import type {
  NormalizedSpec,
  NormalizedSpecWarning,
  NormalizedSpecWarningLocation,
} from "../NormalizedSpec.js";
import type { JsonPointer } from "./Issue.js";

type NormalizationErrorTag = NormalizationError["_tag"];
const NORMALIZATION_ERROR_PATHS = {
  ContradictorySecurityHeaderError: "/resources",
  DerivedResponseCycleError: "/responses",
  DuplicateOperationIdError: "/resources",
  DuplicateResponseNameError: "/responses",
  DuplicateRouteError: "/resources",
  DuplicateSecuritySchemeNameError: "/securitySchemes",
  DuplicateTagNameError: "/metadata",
  EmptyOperationResponsesError: "/resources",
  EmptyResourceOperationsError: "/resources",
  EmptySpecResourcesError: "/resources",
  InvalidApiMetadataError: "/metadata",
  InvalidDerivedResponseError: "/responses",
  InvalidOperationIdError: "/resources",
  InvalidRequestSchemaError: "/resources",
  InvalidResourceNameError: "/resources",
  InvalidSecurityRequirementError: "/security",
  InvalidSecuritySchemeError: "/securitySchemes",
  MissingDerivedResponseParentError: "/responses",
  PathParameterMismatchError: "/resources",
  UnknownSecuritySchemeError: "/security",
  UnknownTagError: "/metadata",
} as const satisfies Readonly<Record<NormalizationErrorTag, JsonPointer>>;
export const pathForNormalizationError = (
  error: NormalizationError
): JsonPointer => NORMALIZATION_ERROR_PATHS[error._tag];
const canonicalResponseWarningPath = (
  location: NormalizedSpecWarningLocation,
  spec: NormalizedSpec
): JsonPointer | undefined => {
  if (location.responseName === undefined) return undefined;
  const index = spec.responses.findIndex(
    response =>
      response.name === location.responseName &&
      (location.statusCode === undefined ||
        response.statusCode === location.statusCode)
  );
  return index < 0 ? undefined : `/responses/${index}/body`;
};
const operationWarningPath = (
  location: NormalizedSpecWarningLocation,
  spec: NormalizedSpec
): JsonPointer | undefined => {
  if (location.resourceName === undefined || location.operationId === undefined)
    return undefined;
  const resourceIndex = spec.resources.findIndex(
    resource => resource.name === location.resourceName
  );
  const resource = spec.resources[resourceIndex];
  if (resource === undefined) return undefined;
  const operationIndex = resource.operations.findIndex(
    operation => operation.operationId === location.operationId
  );
  const operation = resource.operations[operationIndex];
  if (operation === undefined) return undefined;
  const operationPath: JsonPointer = `/resources/${resourceIndex}/operations/${operationIndex}`;
  if (location.part === "request.body") return `${operationPath}/request/body`;
  const responseIndex = operation.responses.findIndex(
    response =>
      response.source === "inline" &&
      response.responseName === location.responseName &&
      (location.statusCode === undefined ||
        response.response.statusCode === location.statusCode)
  );
  return responseIndex < 0
    ? undefined
    : `${operationPath}/responses/${responseIndex}/response/body`;
};
export const pathForNormalizedSpecWarning = (
  warning: NormalizedSpecWarning,
  spec: NormalizedSpec | undefined
): JsonPointer => {
  if (spec === undefined)
    return warning.location.part === "request.body"
      ? "/resources"
      : "/responses";
  return (
    operationWarningPath(warning.location, spec) ??
    canonicalResponseWarningPath(warning.location, spec) ??
    (warning.location.part === "request.body" ? "/resources" : "/responses")
  );
};
