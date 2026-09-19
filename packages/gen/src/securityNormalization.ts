import type {
  OperationDefinition,
  RequestDefinition,
  SecurityRequirements,
  SecuritySchemeDefinition,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import {
  ContradictorySecurityHeaderError,
  DuplicateSecuritySchemeNameError,
  InvalidSecurityRequirementError,
  InvalidSecuritySchemeError,
  UnknownSecuritySchemeError,
} from "./errors/index.js";
import type { NormalizedSecurity } from "./NormalizedSpec.js";

type OAuth2Scheme = Extract<
  SecuritySchemeDefinition,
  { readonly kind: "oauth2" }
>;

type OAuth2Flow = NonNullable<
  OAuth2Scheme["flows"][keyof OAuth2Scheme["flows"]]
>;

type SecurityValidationContext = {
  readonly contractPath: string;
  readonly schemeByName: ReadonlyMap<string, SecuritySchemeDefinition>;
};

export type NormalizedSecuritySchemes = {
  readonly schemes: readonly SecuritySchemeDefinition[];
  readonly byName: ReadonlyMap<string, SecuritySchemeDefinition>;
};

export const isNonEmpty = (value: string): boolean => value.trim().length > 0;

const requireNonEmpty = (
  schemeName: string,
  fieldName: string,
  value: string
): void => {
  if (!isNonEmpty(value)) {
    throw new InvalidSecuritySchemeError({
      schemeName,
      reason: `${fieldName} must not be empty`,
    });
  }
};

const requireHttpUrl = (
  schemeName: string,
  fieldName: string,
  value: string
): void => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new InvalidSecuritySchemeError({
      schemeName,
      reason: `${fieldName} must be an absolute HTTP or HTTPS URL`,
    });
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new InvalidSecuritySchemeError({
      schemeName,
      reason: `${fieldName} must be an absolute HTTP or HTTPS URL`,
    });
  }
};

const requireOptionalHttpUrl = (
  schemeName: string,
  fieldName: string,
  value: string | undefined
): void => {
  if (value !== undefined) {
    requireHttpUrl(schemeName, fieldName, value);
  }
};

const validateImplicitFlow = (
  schemeName: string,
  flow: NonNullable<OAuth2Scheme["flows"]["implicit"]>
): void => {
  requireHttpUrl(
    schemeName,
    "flows.implicit.authorizationUrl",
    flow.authorizationUrl
  );
  requireOptionalHttpUrl(
    schemeName,
    "flows.implicit.refreshUrl",
    flow.refreshUrl
  );
};

const validateTokenFlow = (
  schemeName: string,
  flowName: "password" | "clientCredentials",
  flow: NonNullable<OAuth2Scheme["flows"]["password"]>
): void => {
  requireHttpUrl(schemeName, `flows.${flowName}.tokenUrl`, flow.tokenUrl);
  requireOptionalHttpUrl(
    schemeName,
    `flows.${flowName}.refreshUrl`,
    flow.refreshUrl
  );
};

const validateAuthorizationCodeFlow = (
  schemeName: string,
  flow: NonNullable<OAuth2Scheme["flows"]["authorizationCode"]>
): void => {
  requireHttpUrl(
    schemeName,
    "flows.authorizationCode.authorizationUrl",
    flow.authorizationUrl
  );
  requireHttpUrl(schemeName, "flows.authorizationCode.tokenUrl", flow.tokenUrl);
  requireOptionalHttpUrl(
    schemeName,
    "flows.authorizationCode.refreshUrl",
    flow.refreshUrl
  );
};

const definedOAuth2Flows = (scheme: OAuth2Scheme): readonly OAuth2Flow[] =>
  Object.values(scheme.flows).filter(
    (flow): flow is OAuth2Flow => flow !== undefined
  );

const validateOAuth2Scheme = (scheme: OAuth2Scheme): void => {
  const { flows } = scheme;
  if (definedOAuth2Flows(scheme).length === 0) {
    throw new InvalidSecuritySchemeError({
      schemeName: scheme.name,
      reason: "at least one OAuth2 flow is required",
    });
  }

  if (flows.implicit !== undefined) {
    validateImplicitFlow(scheme.name, flows.implicit);
  }

  if (flows.password !== undefined) {
    validateTokenFlow(scheme.name, "password", flows.password);
  }

  if (flows.clientCredentials !== undefined) {
    validateTokenFlow(
      scheme.name,
      "clientCredentials",
      flows.clientCredentials
    );
  }

  if (flows.authorizationCode !== undefined) {
    validateAuthorizationCodeFlow(scheme.name, flows.authorizationCode);
  }
};

const validateScheme = (scheme: SecuritySchemeDefinition): void => {
  requireNonEmpty(scheme.name, "name", scheme.name);

  switch (scheme.kind) {
    case "http":
      if (scheme.scheme === "basic" && scheme.bearerFormat !== undefined) {
        throw new InvalidSecuritySchemeError({
          schemeName: scheme.name,
          reason: "bearerFormat is only valid for bearer HTTP schemes",
        });
      }
      return;
    case "apiKey":
      requireNonEmpty(scheme.name, "credentialName", scheme.credentialName);
      return;
    case "oauth2":
      validateOAuth2Scheme(scheme);
      return;
    case "openIdConnect":
      requireHttpUrl(scheme.name, "discoveryUrl", scheme.discoveryUrl);
  }
};

export const normalizeSecuritySchemes = (
  schemes: readonly SecuritySchemeDefinition[] | undefined
): NormalizedSecuritySchemes => {
  const normalized = schemes ?? [];
  const byName = new Map<string, SecuritySchemeDefinition>();

  for (const scheme of normalized) {
    validateScheme(scheme);
    if (byName.has(scheme.name)) {
      throw new DuplicateSecuritySchemeNameError({
        schemeName: scheme.name,
      });
    }
    byName.set(scheme.name, scheme);
  }

  return { schemes: normalized, byName };
};

const oauth2Scopes = (scheme: OAuth2Scheme): ReadonlySet<string> =>
  new Set(definedOAuth2Flows(scheme).flatMap(flow => Object.keys(flow.scopes)));

const validateOAuth2Scopes = (
  schemeName: string,
  scopes: readonly string[],
  scheme: OAuth2Scheme,
  contractPath: string
): void => {
  const declaredScopes = oauth2Scopes(scheme);
  for (const scope of scopes) {
    if (!declaredScopes.has(scope)) {
      throw new InvalidSecurityRequirementError({
        schemeName,
        contractPath,
        reason: `scope '${scope}' is not declared by an OAuth2 flow`,
      });
    }
  }
};

const validateSchemeScopes = (
  schemeName: string,
  scopes: readonly string[],
  context: SecurityValidationContext
): void => {
  const scheme = context.schemeByName.get(schemeName);
  if (scheme === undefined) {
    throw new UnknownSecuritySchemeError({
      schemeName,
      contractPath: context.contractPath,
    });
  }

  if (scheme.kind === "oauth2") {
    validateOAuth2Scopes(schemeName, scopes, scheme, context.contractPath);
    return;
  }

  if (
    (scheme.kind === "http" || scheme.kind === "apiKey") &&
    scopes.length > 0
  ) {
    throw new InvalidSecurityRequirementError({
      schemeName,
      contractPath: context.contractPath,
      reason: `${scheme.kind} schemes do not define scopes`,
    });
  }
};

const validateSecurityRequirements = (
  requirements: SecurityRequirements,
  context: SecurityValidationContext
): void => {
  for (const requirement of requirements) {
    const entries = Object.entries(requirement);
    if (entries.length === 0) {
      throw new InvalidSecurityRequirementError({
        contractPath: context.contractPath,
        reason: "requirement objects must name at least one scheme",
      });
    }

    for (const [schemeName, scopes] of entries) {
      validateSchemeScopes(schemeName, scopes, context);
    }
  }
};

export const resolveSecurity = (
  declared: SecurityRequirements | undefined,
  inherited: NormalizedSecurity,
  source: "spec" | "resource" | "operation",
  context: SecurityValidationContext
): NormalizedSecurity => {
  if (declared === undefined) {
    return inherited;
  }

  validateSecurityRequirements(declared, context);
  return { requirements: declared, source };
};

const authorizationSchema = (
  request: RequestDefinition
): z.ZodType | undefined => {
  const header = request.header;
  if (header === undefined) {
    return undefined;
  }

  const unwrapped = header instanceof z.ZodOptional ? header.unwrap() : header;
  if (!(unwrapped instanceof z.ZodObject)) {
    return undefined;
  }

  const authorizationEntry = (
    Object.entries(unwrapped.shape) as [string, z.ZodType][]
  ).find(([name]) => name.toLowerCase() === "authorization");
  return authorizationEntry?.[1];
};

const referencedHttpSchemes = (
  security: NormalizedSecurity,
  schemeByName: ReadonlyMap<string, SecuritySchemeDefinition>
): readonly Extract<SecuritySchemeDefinition, { readonly kind: "http" }>[] => {
  const schemes = new Map<
    string,
    Extract<SecuritySchemeDefinition, { readonly kind: "http" }>
  >();

  for (const requirement of security.requirements) {
    for (const schemeName of Object.keys(requirement)) {
      const scheme = schemeByName.get(schemeName);
      if (scheme?.kind === "http") {
        schemes.set(schemeName, scheme);
      }
    }
  }

  return [...schemes.values()];
};

const validateAuthorizationScheme = (
  operationId: string,
  schema: z.ZodType,
  scheme: Extract<SecuritySchemeDefinition, { readonly kind: "http" }>
): void => {
  const representative =
    scheme.scheme === "bearer"
      ? "Bearer typeweaver-token"
      : "Basic dHlwZXdlYXZlcjp0ZXN0";
  if (!schema.safeParse(representative).success) {
    throw new ContradictorySecurityHeaderError({
      operationId,
      schemeName: scheme.name,
    });
  }
};

export const validateAuthorizationHeader = (
  operation: OperationDefinition,
  security: NormalizedSecurity,
  schemeByName: ReadonlyMap<string, SecuritySchemeDefinition>
): void => {
  const schema = authorizationSchema(operation.request);
  if (schema === undefined) {
    return;
  }

  for (const scheme of referencedHttpSchemes(security, schemeByName)) {
    validateAuthorizationScheme(operation.operationId, schema, scheme);
  }
};
