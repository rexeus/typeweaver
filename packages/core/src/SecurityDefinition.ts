export type SecurityRequirement = Readonly<Record<string, readonly string[]>>;

export type SecurityRequirements = readonly SecurityRequirement[];

export type OAuth2ScopeDefinitions = Readonly<Record<string, string>>;

export type OAuth2ImplicitFlowDefinition = {
  readonly authorizationUrl: string;
  readonly refreshUrl?: string;
  readonly scopes: OAuth2ScopeDefinitions;
};

export type OAuth2PasswordFlowDefinition = {
  readonly tokenUrl: string;
  readonly refreshUrl?: string;
  readonly scopes: OAuth2ScopeDefinitions;
};

export type OAuth2ClientCredentialsFlowDefinition = {
  readonly tokenUrl: string;
  readonly refreshUrl?: string;
  readonly scopes: OAuth2ScopeDefinitions;
};

export type OAuth2AuthorizationCodeFlowDefinition = {
  readonly authorizationUrl: string;
  readonly tokenUrl: string;
  readonly refreshUrl?: string;
  readonly scopes: OAuth2ScopeDefinitions;
};

export type OAuth2FlowsDefinition = {
  readonly implicit?: OAuth2ImplicitFlowDefinition;
  readonly password?: OAuth2PasswordFlowDefinition;
  readonly clientCredentials?: OAuth2ClientCredentialsFlowDefinition;
  readonly authorizationCode?: OAuth2AuthorizationCodeFlowDefinition;
};

type SecuritySchemeBase = {
  readonly name: string;
  readonly description?: string;
};

export type HttpSecuritySchemeDefinition = SecuritySchemeBase & {
  readonly kind: "http";
  readonly scheme: "basic" | "bearer";
  readonly bearerFormat?: string;
};

export type ApiKeySecuritySchemeDefinition = SecuritySchemeBase & {
  readonly kind: "apiKey";
  readonly credentialName: string;
  readonly location: "header" | "query" | "cookie";
};

export type OAuth2SecuritySchemeDefinition = SecuritySchemeBase & {
  readonly kind: "oauth2";
  readonly flows: OAuth2FlowsDefinition;
};

export type OpenIdConnectSecuritySchemeDefinition = SecuritySchemeBase & {
  readonly kind: "openIdConnect";
  readonly discoveryUrl: string;
};

export type SecuritySchemeDefinition =
  | HttpSecuritySchemeDefinition
  | ApiKeySecuritySchemeDefinition
  | OAuth2SecuritySchemeDefinition
  | OpenIdConnectSecuritySchemeDefinition;
