import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import type {
  OpenApiOAuth2FlowObject,
  OpenApiOAuth2FlowsObject,
  OpenApiSecuritySchemeObject,
} from "../types.js";

type SecurityScheme = NormalizedSpec["securitySchemes"][number];
type OAuth2Scheme = Extract<SecurityScheme, { readonly kind: "oauth2" }>;
type OAuth2Flow = NonNullable<
  OAuth2Scheme["flows"][keyof OAuth2Scheme["flows"]]
>;

export const buildSecuritySchemes = (
  schemes: readonly SecurityScheme[]
): Record<string, OpenApiSecuritySchemeObject> => {
  const result: Record<string, OpenApiSecuritySchemeObject> = {};

  for (const scheme of schemes) {
    result[scheme.name] = buildSecurityScheme(scheme);
  }

  return result;
};

const buildSecurityScheme = (
  scheme: SecurityScheme
): OpenApiSecuritySchemeObject => {
  const description =
    scheme.description === undefined ? {} : { description: scheme.description };

  switch (scheme.kind) {
    case "http":
      return {
        type: "http",
        scheme: scheme.scheme,
        ...(scheme.bearerFormat === undefined
          ? {}
          : { bearerFormat: scheme.bearerFormat }),
        ...description,
      };
    case "apiKey":
      return {
        type: "apiKey",
        name: scheme.credentialName,
        in: scheme.location,
        ...description,
      };
    case "oauth2":
      return {
        type: "oauth2",
        flows: buildOAuth2Flows(scheme.flows),
        ...description,
      };
    case "openIdConnect":
      return {
        type: "openIdConnect",
        openIdConnectUrl: scheme.discoveryUrl,
        ...description,
      };
  }
};

const buildOAuth2Flows = (
  flows: OAuth2Scheme["flows"]
): OpenApiOAuth2FlowsObject => ({
  ...(flows.implicit === undefined
    ? {}
    : { implicit: buildOAuth2Flow(flows.implicit) }),
  ...(flows.password === undefined
    ? {}
    : { password: buildOAuth2Flow(flows.password) }),
  ...(flows.clientCredentials === undefined
    ? {}
    : { clientCredentials: buildOAuth2Flow(flows.clientCredentials) }),
  ...(flows.authorizationCode === undefined
    ? {}
    : { authorizationCode: buildOAuth2Flow(flows.authorizationCode) }),
});

const buildOAuth2Flow = (flow: OAuth2Flow): OpenApiOAuth2FlowObject => ({
  ...("authorizationUrl" in flow
    ? { authorizationUrl: flow.authorizationUrl }
    : {}),
  ...("tokenUrl" in flow ? { tokenUrl: flow.tokenUrl } : {}),
  ...(flow.refreshUrl === undefined ? {} : { refreshUrl: flow.refreshUrl }),
  scopes: { ...flow.scopes },
});
