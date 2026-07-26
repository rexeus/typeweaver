import { openApiPlugin } from "./openApiPlugin.js";

export { buildOpenApiDocument } from "./buildOpenApiDocument.js";
export { openApiPlugin } from "./openApiPlugin.js";
export {
  OPENAPI_WARNING_ISSUE_REGISTRY,
  openApiWarningToIssue,
} from "./warningIssues.js";
export type { OpenApiPluginOptions } from "./openApiPlugin.js";
export type {
  OpenApiWarningCode,
  OpenApiWarningIssueEntry,
} from "./warningIssues.js";
export type {
  BuildOpenApiDocumentOptions,
  OpenApiBuildResult,
  OpenApiBuildWarning,
  OpenApiComponentsObject,
  OpenApiContentObject,
  OpenApiDiagnosticWarning,
  OpenApiDiagnosticWarningCode,
  OpenApiDocument,
  OpenApiHeaderObject,
  OpenApiInfoObject,
  OpenApiMediaTypeObject,
  OpenApiOperationObject,
  OpenApiParameterObject,
  OpenApiPathItemObject,
  OpenApiPathsObject,
  OpenApiReferenceObject,
  OpenApiRequestBodyObject,
  OpenApiResponseObject,
  OpenApiResponsesObject,
  OpenApiSchemaConversionWarning,
  OpenApiSchemaConversionWarningCode,
  OpenApiSecurityRequirement,
  OpenApiSecurityRequirements,
  OpenApiSecuritySchemeObject,
  OpenApiServerObject,
  OpenApiTagObject,
  OpenApiTarget,
  OpenApiWarningLocation,
} from "./types.js";

export default openApiPlugin;
