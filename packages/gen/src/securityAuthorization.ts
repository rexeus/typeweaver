import type {
  OperationDefinition,
  SecuritySchemeDefinition,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import { ContradictorySecurityHeaderError } from "./errors/index.js";
import type { NormalizedSecurity } from "./NormalizedSpec.js";

const authorizationSchema = (
  request: OperationDefinition["request"]
): z.core.$ZodType | undefined => {
  const header = request?.header;
  if (header === undefined) return undefined;
  const unwrapped = header instanceof z.ZodOptional ? header.unwrap() : header;
  if (!(unwrapped instanceof z.ZodObject)) return undefined;
  const shape: z.core.$ZodShape = unwrapped.shape;
  return Object.entries(shape).find(
    ([name]) => name.toLowerCase() === "authorization"
  )?.[1];
};
const referencedHttpSchemes = (
  security: NormalizedSecurity,
  schemeByName: ReadonlyMap<string, SecuritySchemeDefinition>
): readonly Extract<SecuritySchemeDefinition, { readonly kind: "http" }>[] => {
  const schemes = new Map<
    string,
    Extract<SecuritySchemeDefinition, { readonly kind: "http" }>
  >();
  for (const requirement of security.requirements)
    for (const schemeName of Object.keys(requirement)) {
      const scheme = schemeByName.get(schemeName);
      if (scheme?.kind === "http") schemes.set(schemeName, scheme);
    }
  return [...schemes.values()];
};
const validateAuthorizationScheme = (
  operationId: string,
  schema: z.core.$ZodType,
  scheme: Extract<SecuritySchemeDefinition, { readonly kind: "http" }>
): void => {
  const representative =
    scheme.scheme === "bearer"
      ? "Bearer typeweaver-token"
      : "Basic dHlwZXdlYXZlcjp0ZXN0";
  if (!z.safeParse(schema, representative).success)
    throw new ContradictorySecurityHeaderError({
      operationId,
      schemeName: scheme.name,
    });
};
export const validateAuthorizationHeader = (
  operation: OperationDefinition,
  security: NormalizedSecurity,
  schemeByName: ReadonlyMap<string, SecuritySchemeDefinition>
): void => {
  const schema = authorizationSchema(operation.request);
  if (schema === undefined) return;
  for (const scheme of referencedHttpSchemes(security, schemeByName))
    validateAuthorizationScheme(operation.operationId, schema, scheme);
};
