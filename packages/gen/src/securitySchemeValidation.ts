import type { SecuritySchemeDefinition } from "@rexeus/typeweaver-core";
import { InvalidSecuritySchemeError } from "./errors/index.js";

type OAuth2Scheme = Extract<
  SecuritySchemeDefinition,
  { readonly kind: "oauth2" }
>;
type OAuth2Flow = NonNullable<
  OAuth2Scheme["flows"][keyof OAuth2Scheme["flows"]]
>;

const requireNonEmpty = (
  schemeName: string,
  fieldName: string,
  value: string
): void => {
  if (value.trim().length === 0)
    throw new InvalidSecuritySchemeError({
      schemeName,
      reason: `${fieldName} must not be empty`,
    });
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
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new InvalidSecuritySchemeError({
      schemeName,
      reason: `${fieldName} must be an absolute HTTP or HTTPS URL`,
    });
};
const requireOptionalHttpUrl = (
  schemeName: string,
  fieldName: string,
  value: string | undefined
): void => {
  if (value !== undefined) requireHttpUrl(schemeName, fieldName, value);
};
const validateImplicitFlow = (
  name: string,
  flow: NonNullable<OAuth2Scheme["flows"]["implicit"]>
): void => {
  requireHttpUrl(
    name,
    "flows.implicit.authorizationUrl",
    flow.authorizationUrl
  );
  requireOptionalHttpUrl(name, "flows.implicit.refreshUrl", flow.refreshUrl);
};
const validateTokenFlow = (
  name: string,
  flowName: "password" | "clientCredentials",
  flow: NonNullable<OAuth2Scheme["flows"]["password"]>
): void => {
  requireHttpUrl(name, `flows.${flowName}.tokenUrl`, flow.tokenUrl);
  requireOptionalHttpUrl(name, `flows.${flowName}.refreshUrl`, flow.refreshUrl);
};
const validateAuthorizationCodeFlow = (
  name: string,
  flow: NonNullable<OAuth2Scheme["flows"]["authorizationCode"]>
): void => {
  requireHttpUrl(
    name,
    "flows.authorizationCode.authorizationUrl",
    flow.authorizationUrl
  );
  requireHttpUrl(name, "flows.authorizationCode.tokenUrl", flow.tokenUrl);
  requireOptionalHttpUrl(
    name,
    "flows.authorizationCode.refreshUrl",
    flow.refreshUrl
  );
};
const definedOAuth2Flows = (scheme: OAuth2Scheme): readonly OAuth2Flow[] =>
  Object.values(scheme.flows).filter(
    (flow): flow is OAuth2Flow => flow !== undefined
  );
const validateOAuth2Scheme = (scheme: OAuth2Scheme): void => {
  if (definedOAuth2Flows(scheme).length === 0)
    throw new InvalidSecuritySchemeError({
      schemeName: scheme.name,
      reason: "at least one OAuth2 flow is required",
    });
  if (scheme.flows.implicit !== undefined)
    validateImplicitFlow(scheme.name, scheme.flows.implicit);
  if (scheme.flows.password !== undefined)
    validateTokenFlow(scheme.name, "password", scheme.flows.password);
  if (scheme.flows.clientCredentials !== undefined)
    validateTokenFlow(
      scheme.name,
      "clientCredentials",
      scheme.flows.clientCredentials
    );
  if (scheme.flows.authorizationCode !== undefined)
    validateAuthorizationCodeFlow(scheme.name, scheme.flows.authorizationCode);
};
export const validateSecurityScheme = (
  scheme: SecuritySchemeDefinition
): void => {
  requireNonEmpty(scheme.name, "name", scheme.name);
  switch (scheme.kind) {
    case "http":
      if (scheme.scheme === "basic" && scheme.bearerFormat !== undefined)
        throw new InvalidSecuritySchemeError({
          schemeName: scheme.name,
          reason: "bearerFormat is only valid for bearer HTTP schemes",
        });
      return;
    case "apiKey":
      requireNonEmpty(scheme.name, "credentialName", scheme.credentialName);
      return;
    case "oauth2":
      validateOAuth2Scheme(scheme);
      return;
    case "openIdConnect":
      requireHttpUrl(scheme.name, "discoveryUrl", scheme.discoveryUrl);
      return;
  }
};
