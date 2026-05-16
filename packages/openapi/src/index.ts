import { openApiPlugin } from "./openApiPlugin.js";

export { buildOpenApiDocument } from "./buildOpenApiDocument.js";
export { openApiPlugin } from "./openApiPlugin.js";
export type { OpenApiPluginOptions } from "./openApiPlugin.js";
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
  OpenApiServerObject,
  OpenApiTagObject,
  OpenApiWarningLocation,
} from "./types.js";

export default openApiPlugin;
