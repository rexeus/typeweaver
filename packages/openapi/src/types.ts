import type {
  JsonSchema,
  JsonSchemaValue,
} from "@rexeus/typeweaver-zod-to-json-schema";

export type BuildOpenApiDocumentOptions = {
  readonly target?: OpenApiTarget;
  readonly servers?: readonly OpenApiServerObject[];
};

export type OpenApiTarget = "3.1.2" | "3.2.0";

export type OpenApiBuildResult = {
  readonly document: OpenApiDocument;
  readonly warnings: readonly OpenApiBuildWarning[];
};

export type OpenApiDocument = {
  readonly openapi: OpenApiTarget;
  readonly jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema";
  readonly info: OpenApiInfoObject;
  readonly servers?: readonly OpenApiServerObject[];
  readonly tags: readonly OpenApiTagObject[];
  readonly paths: OpenApiPathsObject;
  readonly components?: OpenApiComponentsObject;
  readonly security?: OpenApiSecurityRequirements;
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
  readonly description?: string;
  readonly deprecated?: boolean;
  readonly tags: readonly string[];
  readonly parameters?: readonly OpenApiParameterObject[];
  readonly requestBody?: OpenApiRequestBodyObject;
  readonly responses: OpenApiResponsesObject;
  readonly security?: OpenApiSecurityRequirements;
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
  readonly description?: string;
  readonly required: boolean;
  readonly schema: JsonSchema;
};

export type OpenApiComponentsObject = {
  readonly responses?: Record<string, OpenApiResponseObject>;
  readonly schemas?: Record<string, JsonSchema>;
  readonly securitySchemes?: Record<string, OpenApiSecuritySchemeObject>;
};

export type OpenApiSecurityRequirement = Readonly<
  Record<string, readonly string[]>
>;

export type OpenApiSecurityRequirements = readonly OpenApiSecurityRequirement[];

type OpenApiSecuritySchemeBase = {
  readonly description?: string;
};

export type OpenApiHttpSecuritySchemeObject = OpenApiSecuritySchemeBase & {
  readonly type: "http";
  readonly scheme: "basic" | "bearer";
  readonly bearerFormat?: string;
};

export type OpenApiApiKeySecuritySchemeObject = OpenApiSecuritySchemeBase & {
  readonly type: "apiKey";
  readonly name: string;
  readonly in: "header" | "query" | "cookie";
};

export type OpenApiOAuth2FlowObject = {
  readonly authorizationUrl?: string;
  readonly tokenUrl?: string;
  readonly refreshUrl?: string;
  readonly scopes: Readonly<Record<string, string>>;
};

export type OpenApiOAuth2FlowsObject = {
  readonly implicit?: OpenApiOAuth2FlowObject;
  readonly password?: OpenApiOAuth2FlowObject;
  readonly clientCredentials?: OpenApiOAuth2FlowObject;
  readonly authorizationCode?: OpenApiOAuth2FlowObject;
};

export type OpenApiOAuth2SecuritySchemeObject = OpenApiSecuritySchemeBase & {
  readonly type: "oauth2";
  readonly flows: OpenApiOAuth2FlowsObject;
};

export type OpenApiOpenIdConnectSecuritySchemeObject =
  OpenApiSecuritySchemeBase & {
    readonly type: "openIdConnect";
    readonly openIdConnectUrl: string;
  };

export type OpenApiSecuritySchemeObject =
  | OpenApiHttpSecuritySchemeObject
  | OpenApiApiKeySecuritySchemeObject
  | OpenApiOAuth2SecuritySchemeObject
  | OpenApiOpenIdConnectSecuritySchemeObject;

export type OpenApiSchemaConversionWarningCode =
  | "unsupported-schema"
  | "unsupported-check"
  | "conversion-error";

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
  | "missing-canonical-response"
  | "duplicate-canonical-response"
  | "unrepresentable-resource-description";

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
