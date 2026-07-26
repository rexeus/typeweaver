import type { SecuritySchemeDefinition } from "@rexeus/typeweaver-core";
import { getRequestHeaderDefaults } from "@rexeus/typeweaver-clients";
import type {
  NormalizedOperation,
  NormalizedRequest,
  NormalizedSpec,
} from "@rexeus/typeweaver-gen";
import { kebabCase, pascalCase } from "polycase";
import { z } from "zod";

export type CommandInputTarget = "path" | "query" | "header";

export type CommandInputModel = {
  readonly flag: string;
  readonly key: string;
  readonly target: CommandInputTarget;
  readonly required: boolean;
  readonly multiple: boolean;
};

export type CommandSecuritySchemeModel =
  | {
      readonly name: string;
      readonly flag: string;
      readonly kind: "http";
      readonly scheme: "basic" | "bearer";
    }
  | {
      readonly name: string;
      readonly flag: string;
      readonly kind: "apiKey";
      readonly credentialName: string;
      readonly location: "header" | "query" | "cookie";
    }
  | {
      readonly name: string;
      readonly flag: string;
      readonly kind: "oauth2" | "openIdConnect";
    };

export type CommandSecurityModel = {
  readonly requirements: readonly (readonly string[])[];
  readonly schemes: readonly CommandSecuritySchemeModel[];
};

export type CommandOperationModel = {
  readonly resourceIndex: number;
  readonly operationIndex: number;
  readonly resourceName: string;
  readonly operationId: string;
  readonly exportName: string;
  readonly commandName: string;
  readonly summary: string;
  readonly method: NormalizedOperation["method"];
  readonly path: string;
  readonly inputs: readonly CommandInputModel[];
  readonly headerDefaults: Readonly<Record<string, string>>;
  readonly security: CommandSecurityModel;
  readonly hasHeader: boolean;
  readonly hasParam: boolean;
  readonly hasQuery: boolean;
  readonly hasBody: boolean;
  readonly bodyTransport?: NonNullable<NormalizedRequest["body"]>["transport"];
  readonly unsupportedTargets: readonly CommandInputTarget[];
};

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

const getObjectShape = (
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

const buildSecurityModel = (
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

const buildInputs = (params: {
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
    const normalizedKey = key.toLowerCase();
    const excluded =
      excludedCredentials.has(normalizedKey) ||
      (params.target === "header" &&
        params.headerDefaultKeys.has(normalizedKey));
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

const unsupportedTargets = (
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

export const buildCommandOperationModels = (
  spec: NormalizedSpec
): readonly CommandOperationModel[] =>
  spec.resources.flatMap((resource, resourceIndex) =>
    resource.operations.map((operation, operationIndex) => {
      const security = buildSecurityModel(spec, operation);
      const headerDefaultEntries =
        getRequestHeaderDefaults(operation.request)?.entries ?? [];
      const headerDefaults = Object.fromEntries(
        headerDefaultEntries.map(entry => [entry.key, entry.value])
      );
      const headerDefaultKeys = new Set(
        headerDefaultEntries.map(entry => entry.key.toLowerCase())
      );
      return {
        resourceIndex,
        operationIndex,
        resourceName: resource.name,
        operationId: operation.operationId,
        exportName: `${pascalCase(operation.operationId)}Command`,
        commandName: kebabCase(operation.operationId),
        summary: operation.summary,
        method: operation.method,
        path: operation.path,
        inputs: buildInputs({
          request: operation.request,
          security,
          headerDefaultKeys,
        }),
        headerDefaults,
        security,
        hasHeader: operation.request?.header !== undefined,
        hasParam: operation.request?.param !== undefined,
        hasQuery: operation.request?.query !== undefined,
        hasBody: operation.request?.body !== undefined,
        ...(operation.request?.body === undefined
          ? {}
          : { bodyTransport: operation.request.body.transport }),
        unsupportedTargets: unsupportedTargets(operation.request),
      };
    })
  );
