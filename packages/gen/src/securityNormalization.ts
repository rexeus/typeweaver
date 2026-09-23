import type {
  SecurityRequirements,
  SecuritySchemeDefinition,
} from "@rexeus/typeweaver-core";
import {
  DuplicateSecuritySchemeNameError,
  InvalidSecurityRequirementError,
  UnknownSecuritySchemeError,
} from "./errors/index.js";
import { validateSecurityScheme } from "./securitySchemeValidation.js";
import type { NormalizedSecurity } from "./NormalizedSpec.js";

type SecurityValidationContext = {
  readonly contractPath: string;
  readonly schemeByName: ReadonlyMap<string, SecuritySchemeDefinition>;
};
export type NormalizedSecuritySchemes = {
  readonly schemes: readonly SecuritySchemeDefinition[];
  readonly byName: ReadonlyMap<string, SecuritySchemeDefinition>;
};
export const isNonEmpty = (value: string): boolean => value.trim().length > 0;

export const normalizeSecuritySchemes = (
  schemes: readonly SecuritySchemeDefinition[] | undefined
): NormalizedSecuritySchemes => {
  const normalized = schemes ?? [];
  const byName = new Map<string, SecuritySchemeDefinition>();
  for (const scheme of normalized) {
    validateSecurityScheme(scheme);
    if (byName.has(scheme.name))
      throw new DuplicateSecuritySchemeNameError({ schemeName: scheme.name });
    byName.set(scheme.name, scheme);
  }
  return { schemes: normalized, byName };
};
const oauth2Scopes = (
  scheme: Extract<SecuritySchemeDefinition, { readonly kind: "oauth2" }>
): ReadonlySet<string> =>
  new Set(
    Object.values(scheme.flows)
      .filter(flow => flow !== undefined)
      .flatMap(flow => Object.keys(flow.scopes))
  );
const validateSchemeScopes = (
  schemeName: string,
  scopes: readonly string[],
  context: SecurityValidationContext
): void => {
  const scheme = context.schemeByName.get(schemeName);
  if (scheme === undefined)
    throw new UnknownSecuritySchemeError({
      schemeName,
      contractPath: context.contractPath,
    });
  if (scheme.kind === "oauth2") {
    const declaredScopes = oauth2Scopes(scheme);
    for (const scope of scopes)
      if (!declaredScopes.has(scope))
        throw new InvalidSecurityRequirementError({
          schemeName,
          contractPath: context.contractPath,
          reason: `scope '${scope}' is not declared by an OAuth2 flow`,
        });
    return;
  }
  if ((scheme.kind === "http" || scheme.kind === "apiKey") && scopes.length > 0)
    throw new InvalidSecurityRequirementError({
      schemeName,
      contractPath: context.contractPath,
      reason: `${scheme.kind} schemes do not define scopes`,
    });
};
const validateSecurityRequirements = (
  requirements: SecurityRequirements,
  context: SecurityValidationContext
): void => {
  for (const requirement of requirements) {
    const entries = Object.entries(requirement);
    if (entries.length === 0)
      throw new InvalidSecurityRequirementError({
        contractPath: context.contractPath,
        reason: "requirement objects must name at least one scheme",
      });
    for (const [schemeName, scopes] of entries)
      validateSchemeScopes(schemeName, scopes, context);
  }
};
export const resolveSecurity = (
  declared: SecurityRequirements | undefined,
  inherited: NormalizedSecurity,
  source: "spec" | "resource" | "operation",
  context: SecurityValidationContext
): NormalizedSecurity => {
  if (declared === undefined) return inherited;
  validateSecurityRequirements(declared, context);
  return { requirements: declared, source };
};
