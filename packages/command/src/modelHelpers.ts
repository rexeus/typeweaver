import type { SecuritySchemeDefinition } from "@rexeus/typeweaver-core";
import type {
  NormalizedOperation,
  NormalizedRequest,
  NormalizedSpec,
} from "@rexeus/typeweaver-gen";
import { kebabCase } from "polycase";
import { z } from "zod";
import type {
  CommandInputModel,
  CommandInputTarget,
  CommandSecurityModel,
  CommandSecuritySchemeModel,
} from "./modelTypes.js";

type ZodObjectWithShape = z.ZodObject<Record<string, z.ZodType>> & {
  readonly shape: Record<string, z.ZodType>;
};
const unwrapOptional = (schema: z.ZodType): z.ZodType => {
  if (!(schema instanceof z.ZodOptional)) return schema;
  const inner = schema.unwrap();
  return inner instanceof z.ZodType ? inner : schema;
};
const isZodObject = (schema: z.ZodType): schema is ZodObjectWithShape =>
  schema instanceof z.ZodObject;
export const getObjectShape = (
  schema: z.ZodType | undefined
): Readonly<Record<string, z.ZodType>> | undefined => {
  if (schema === undefined) return undefined;
  const unwrapped = unwrapOptional(schema);
  return isZodObject(unwrapped) ? unwrapped.shape : undefined;
};
const isContainerOptional = (schema: z.ZodType | undefined): boolean =>
  schema?.safeParse(undefined).success ?? true;
const isMultiple = (schema: z.ZodType): boolean =>
  unwrapOptional(schema) instanceof z.ZodArray;
const authFlag = (schemeName: string): string =>
  `auth-${kebabCase(schemeName)}`;

const securitySchemeModel = (
  scheme: SecuritySchemeDefinition
): CommandSecuritySchemeModel => {
  const flag = authFlag(scheme.name);
  switch (scheme.kind) {
    case "http":
      return {
        name: scheme.name,
        flag,
        kind: scheme.kind,
        scheme: scheme.scheme,
      };
    case "apiKey":
      return {
        name: scheme.name,
        flag,
        kind: scheme.kind,
        credentialName: scheme.credentialName,
        location: scheme.location,
      };
    case "oauth2":
    case "openIdConnect":
      return { name: scheme.name, flag, kind: scheme.kind };
  }
};
export const buildSecurityModel = (
  spec: NormalizedSpec,
  operation: NormalizedOperation
): CommandSecurityModel => {
  const requirements = operation.security.requirements.map(requirement =>
    Object.keys(requirement).sort()
  );
  const referencedNames = new Set(requirements.flat());
  const schemes = spec.securitySchemes
    .filter(scheme => referencedNames.has(scheme.name))
    .map(securitySchemeModel)
    .sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0
    );
  return { requirements, schemes };
};
const headerCredentialKey = (
  scheme: CommandSecuritySchemeModel
): string | undefined => {
  if (scheme.kind !== "apiKey") return "authorization";
  return scheme.location === "header"
    ? scheme.credentialName.toLowerCase()
    : undefined;
};
const queryCredentialKey = (
  scheme: CommandSecuritySchemeModel
): string | undefined =>
  scheme.kind === "apiKey" && scheme.location === "query"
    ? scheme.credentialName.toLowerCase()
    : undefined;
const credentialKeys = (
  security: CommandSecurityModel,
  target: CommandInputTarget
): ReadonlySet<string> => {
  const keyForScheme =
    target === "header"
      ? headerCredentialKey
      : target === "query"
        ? queryCredentialKey
        : () => undefined;
  return new Set(
    security.schemes.map(keyForScheme).filter(key => key !== undefined)
  );
};
export const buildInputs = (params: {
  readonly request: NormalizedRequest | undefined;
  readonly security: CommandSecurityModel;
  readonly headerDefaultKeys: ReadonlySet<string>;
}): readonly CommandInputModel[] => {
  const inputs: CommandInputModel[] = [];
  const parts: readonly {
    readonly target: CommandInputTarget;
    readonly schema: z.ZodType | undefined;
  }[] = [
    { target: "path", schema: params.request?.param },
    { target: "query", schema: params.request?.query },
    { target: "header", schema: params.request?.header },
  ];
  for (const part of parts) {
    const shape = getObjectShape(part.schema);
    if (shape === undefined) continue;
    inputs.push(
      ...inputsForShape({
        target: part.target,
        schema: part.schema,
        shape,
        security: params.security,
        headerDefaultKeys: params.headerDefaultKeys,
      })
    );
  }
  return inputs;
};
const inputsForShape = (params: {
  readonly target: CommandInputTarget;
  readonly schema: z.ZodType | undefined;
  readonly shape: Readonly<Record<string, z.ZodType>>;
  readonly security: CommandSecurityModel;
  readonly headerDefaultKeys: ReadonlySet<string>;
}): readonly CommandInputModel[] => {
  const excludedCredentials = credentialKeys(params.security, params.target);
  const containerOptional = isContainerOptional(params.schema);
  return Object.entries(params.shape).flatMap(([key, schema]) => {
    const excluded =
      excludedCredentials.has(key.toLowerCase()) ||
      (params.target === "header" &&
        params.headerDefaultKeys.has(key.toLowerCase()));
    return excluded
      ? []
      : [
          {
            flag: `${params.target}-${kebabCase(key)}`,
            key,
            target: params.target,
            required: !containerOptional && !schema.isOptional(),
            multiple: isMultiple(schema),
          },
        ];
  });
};
export const unsupportedTargets = (
  request: NormalizedRequest | undefined
): readonly CommandInputTarget[] => {
  const candidates: readonly {
    readonly target: CommandInputTarget;
    readonly schema: z.ZodType | undefined;
  }[] = [
    { target: "query", schema: request?.query },
    { target: "header", schema: request?.header },
  ];
  return candidates
    .filter(
      candidate =>
        candidate.schema !== undefined &&
        getObjectShape(candidate.schema) === undefined
    )
    .map(candidate => candidate.target);
};
