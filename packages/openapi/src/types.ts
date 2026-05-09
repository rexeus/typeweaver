import type {
  JsonSchema,
  JsonSchemaValue,
  ZodToJsonSchemaWarningCode,
} from "@rexeus/typeweaver-zod-to-json-schema";

export type BuildOpenApiDocumentOptions = {
  readonly info: OpenApiInfoObject;
  readonly servers?: readonly OpenApiServerObject[];
};

export type OpenApiBuildResult = {
  readonly document: OpenApiDocument;
  readonly warnings: readonly OpenApiBuildWarning[];
};

export type OpenApiDocument = {
  readonly openapi: "3.1.1";
  readonly info: OpenApiInfoObject;
  readonly servers?: readonly OpenApiServerObject[];
  readonly tags: readonly OpenApiTagObject[];
  readonly paths: OpenApiPathsObject;
  readonly components?: OpenApiComponentsObject;
};

export type OpenApiInfoObject = {
  readonly title: string;
  readonly version: string;
  readonly summary?: string;
  readonly description?: string;
  readonly termsOfService?: string;
  readonly [key: string]: JsonSchemaValue | undefined;
};

export type OpenApiServerObject = {
  readonly url: string;
  readonly description?: string;
  readonly [key: string]: JsonSchemaValue | undefined;
};

export type OpenApiTagObject = {
  readonly name: string;
  readonly description?: string;
};

export type OpenApiPathsObject = Record<string, OpenApiPathItemObject>;

export type OpenApiPathItemObject = Partial<
  Record<OpenApiHttpMethod, OpenApiOperationObject>
>;

export type OpenApiHttpMethod =
  | "get"
  | "put"
  | "post"
  | "delete"
  | "options"
  | "head"
  | "patch";

export type OpenApiOperationObject = {
  readonly operationId: string;
  readonly summary?: string;
  readonly tags: readonly string[];
  readonly parameters?: readonly OpenApiParameterObject[];
  readonly requestBody?: OpenApiRequestBodyObject;
  readonly responses: OpenApiResponsesObject;
};

export type OpenApiParameterObject = {
  readonly name: string;
  readonly in: "path" | "query" | "header";
  readonly required: boolean;
  readonly schema: JsonSchema;
};

export type OpenApiRequestBodyObject = {
  readonly required: boolean;
  readonly content: OpenApiContentObject;
};

export type OpenApiContentObject = Record<string, OpenApiMediaTypeObject>;

export type OpenApiMediaTypeObject = {
  readonly schema: JsonSchema;
};

export type OpenApiResponsesObject = Record<
  string,
  OpenApiResponseObject | OpenApiReferenceObject
>;

export type OpenApiReferenceObject = {
  readonly $ref: string;
};

export type OpenApiResponseObject = {
  readonly description: string;
  readonly headers?: Record<string, OpenApiHeaderObject>;
  readonly content?: OpenApiContentObject;
};

export type OpenApiHeaderObject = {
  readonly required: boolean;
  readonly schema: JsonSchema;
};

export type OpenApiComponentsObject = {
  readonly responses?: Record<string, OpenApiResponseObject>;
};

export type OpenApiSchemaConversionWarningCode = ZodToJsonSchemaWarningCode;

export type OpenApiSchemaConversionWarning = {
  readonly origin: "schema-conversion";
  readonly code: OpenApiSchemaConversionWarningCode;
  readonly message: string;
  readonly schemaType: string;
  readonly schemaPath: string;
  readonly documentPath: string;
  readonly location: OpenApiWarningLocation;
};

export type OpenApiDiagnosticWarningCode =
  | "unrepresentable-parameter-container"
  | "unrepresentable-parameter-additional-properties"
  | "missing-path-parameter-schema"
  | "unused-path-parameter-schema"
  | "duplicate-response-status"
  | "missing-canonical-response";

export type OpenApiDiagnosticWarning = {
  readonly origin: "openapi-builder";
  readonly code: OpenApiDiagnosticWarningCode;
  readonly message: string;
  readonly documentPath: string;
  readonly location: OpenApiWarningLocation;
};

export type OpenApiBuildWarning =
  | OpenApiSchemaConversionWarning
  | OpenApiDiagnosticWarning;

export type OpenApiWarningLocation = {
  readonly resourceName?: string;
  readonly operationId?: string;
  readonly method?: string;
  readonly path?: string;
  readonly openApiPath?: string;
  readonly part?: string;
  readonly parameterName?: string;
  readonly responseName?: string;
  readonly statusCode?: string;
};
