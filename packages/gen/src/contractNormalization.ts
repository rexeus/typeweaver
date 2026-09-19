import type {
  ApiMetadataDefinition,
  OperationDefinition,
  ResourceDefinition,
  SecuritySchemeDefinition,
  SpecDefinition,
} from "@rexeus/typeweaver-core";
import {
  DuplicateTagNameError,
  InvalidApiMetadataError,
  UnknownTagError,
} from "./errors/index.js";
import {
  isNonEmpty,
  normalizeSecuritySchemes,
  resolveSecurity,
  validateAuthorizationHeader,
} from "./securityNormalization.js";
import type { NormalizedSecurity } from "./NormalizedSpec.js";

const NO_SECURITY: NormalizedSecurity = {
  requirements: [],
  source: "none",
};

type ContractRoot = {
  readonly metadata: ApiMetadataDefinition;
  readonly securitySchemes: readonly SecuritySchemeDefinition[];
  readonly schemeByName: ReadonlyMap<string, SecuritySchemeDefinition>;
  readonly tagNames: ReadonlySet<string>;
  readonly security: NormalizedSecurity;
};

export type NormalizedResourceContract = {
  readonly description?: string | undefined;
  readonly tags: readonly string[];
  readonly security: NormalizedSecurity;
};

export type NormalizedOperationContract = {
  readonly description?: string | undefined;
  readonly deprecated: boolean;
  readonly tags: readonly string[];
  readonly security: NormalizedSecurity;
};

const validateMetadata = (
  metadata: ApiMetadataDefinition
): ReadonlySet<string> => {
  if (!isNonEmpty(metadata.title)) {
    throw new InvalidApiMetadataError({
      field: "title",
      reason: "must not be empty",
    });
  }
  if (!isNonEmpty(metadata.version)) {
    throw new InvalidApiMetadataError({
      field: "version",
      reason: "must not be empty",
    });
  }

  const tagNames = new Set<string>();
  for (const tag of metadata.tags ?? []) {
    if (!isNonEmpty(tag.name)) {
      throw new InvalidApiMetadataError({
        field: "tags",
        reason: "tag names must not be empty",
      });
    }
    if (tagNames.has(tag.name)) {
      throw new DuplicateTagNameError({ tagName: tag.name });
    }
    tagNames.add(tag.name);
  }
  return tagNames;
};

const validateTagReferences = (
  tags: readonly string[] | undefined,
  contractPath: string,
  tagNames: ReadonlySet<string>
): readonly string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const tag of tags ?? []) {
    if (!tagNames.has(tag)) {
      throw new UnknownTagError({ tagName: tag, contractPath });
    }
    if (!seen.has(tag)) {
      seen.add(tag);
      normalized.push(tag);
    }
  }
  return normalized;
};

const mergeTags = (
  inherited: readonly string[],
  declared: readonly string[]
): readonly string[] => {
  const tags = [...inherited];
  const seen = new Set(inherited);
  for (const tag of declared) {
    if (!seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags;
};

export const normalizeContractRoot = (
  definition: SpecDefinition
): ContractRoot => {
  const tagNames = validateMetadata(definition.metadata);
  const schemes = normalizeSecuritySchemes(definition.securitySchemes);
  const security = resolveSecurity(definition.security, NO_SECURITY, "spec", {
    contractPath: "/security",
    schemeByName: schemes.byName,
  });

  return {
    metadata: definition.metadata,
    securitySchemes: schemes.schemes,
    schemeByName: schemes.byName,
    tagNames,
    security,
  };
};

export const normalizeResourceContract = (
  resourceName: string,
  resource: ResourceDefinition,
  root: ContractRoot
): NormalizedResourceContract => {
  const contractPath = `/resources/${resourceName}`;
  return {
    description: resource.description,
    tags: validateTagReferences(
      resource.tags,
      `${contractPath}/tags`,
      root.tagNames
    ),
    security: resolveSecurity(resource.security, root.security, "resource", {
      contractPath: `${contractPath}/security`,
      schemeByName: root.schemeByName,
    }),
  };
};

export const normalizeOperationContract = (
  resourceName: string,
  resource: NormalizedResourceContract,
  operation: OperationDefinition,
  root: ContractRoot
): NormalizedOperationContract => {
  const contractPath = `/resources/${resourceName}/operations/${operation.operationId}`;
  const declaredTags = validateTagReferences(
    operation.tags,
    `${contractPath}/tags`,
    root.tagNames
  );
  const security = resolveSecurity(
    operation.security,
    resource.security,
    "operation",
    {
      contractPath: `${contractPath}/security`,
      schemeByName: root.schemeByName,
    }
  );
  validateAuthorizationHeader(operation, security, root.schemeByName);

  return {
    description: operation.description,
    deprecated: operation.deprecated ?? false,
    tags: mergeTags(resource.tags, declaredTags),
    security,
  };
};
