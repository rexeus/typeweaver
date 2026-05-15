import {
  HttpStatusCodeNameMap,
  isNamedResponseDefinition,
} from "@rexeus/typeweaver-core";
import type {
  ResponseDefinition,
  SpecDefinition,
} from "@rexeus/typeweaver-core";
import { normalizeBody } from "../bodyNormalization.js";
import {
  DerivedResponseCycleError,
  InvalidDerivedResponseError,
  MissingDerivedResponseParentError,
} from "../errors/index.js";
import type {
  NormalizedResponse,
  NormalizedSpecWarning,
  NormalizedSpecWarningLocation,
} from "../NormalizedSpec.js";

export type NormalizeResponseDefinitionResult = {
  readonly response: NormalizedResponse;
  readonly warnings: readonly NormalizedSpecWarning[];
};

export type CollectCanonicalResponsesResult = {
  readonly responses: Map<string, NormalizedResponse>;
  readonly warnings: readonly NormalizedSpecWarning[];
};

export const validateDerivedResponseMetadata = (
  response: ResponseDefinition
): void => {
  const derived = response.derived;

  if (derived === undefined) {
    return;
  }

  if (derived.parentName === response.name) {
    throw new DerivedResponseCycleError(response.name);
  }

  if (derived.lineage.length === 0) {
    throw new InvalidDerivedResponseError(response.name);
  }

  if (derived.lineage.at(-1) !== response.name) {
    throw new InvalidDerivedResponseError(response.name);
  }

  if (derived.lineage.length !== derived.depth) {
    throw new InvalidDerivedResponseError(response.name);
  }

  if (new Set(derived.lineage).size !== derived.lineage.length) {
    throw new DerivedResponseCycleError(response.name);
  }

  if (derived.depth > 1 && derived.lineage.at(-2) !== derived.parentName) {
    throw new InvalidDerivedResponseError(response.name);
  }
};

export const collectCanonicalResponseDefinitions = (
  definition: SpecDefinition
): Map<string, ResponseDefinition> => {
  const canonicalResponses = new Map<string, ResponseDefinition>();

  for (const resource of Object.values(definition.resources)) {
    for (const operation of resource.operations) {
      for (const response of operation.responses) {
        if (!isNamedResponseDefinition(response)) {
          continue;
        }

        validateDerivedResponseMetadata(response);

        canonicalResponses.set(response.name, response);
      }
    }
  }

  return canonicalResponses;
};

export const getDerivedResponseChain = (
  response: ResponseDefinition,
  canonicalResponses: ReadonlyMap<string, ResponseDefinition>
): readonly string[] => {
  const chain: string[] = [response.name];
  const visitedResponseNames = new Set(chain);
  let parentName = response.derived?.parentName;

  while (parentName !== undefined) {
    if (visitedResponseNames.has(parentName)) {
      throw new DerivedResponseCycleError(response.name);
    }

    const parentResponse = canonicalResponses.get(parentName);

    if (parentResponse === undefined) {
      throw new MissingDerivedResponseParentError(response.name, parentName);
    }

    chain.unshift(parentResponse.name);
    visitedResponseNames.add(parentResponse.name);
    parentName = parentResponse.derived?.parentName;
  }

  return chain;
};

export const validateDerivedResponseGraph = (
  canonicalResponses: ReadonlyMap<string, ResponseDefinition>
): void => {
  for (const response of canonicalResponses.values()) {
    validateDerivedResponseAgainstCanonicalGraph(response, canonicalResponses);
  }
};

const validateDerivedResponseAgainstCanonicalGraph = (
  response: ResponseDefinition,
  canonicalResponses: ReadonlyMap<string, ResponseDefinition>
): void => {
  if (response.derived === undefined) {
    return;
  }

  const chain = getDerivedResponseChain(response, canonicalResponses);
  const materializedLineage = chain.slice(1);

  if (response.derived.depth !== materializedLineage.length) {
    throw new InvalidDerivedResponseError(response.name);
  }

  if (
    materializedLineage.length !== response.derived.lineage.length ||
    materializedLineage.some(
      (lineageEntry, index) => lineageEntry !== response.derived?.lineage[index]
    )
  ) {
    throw new InvalidDerivedResponseError(response.name);
  }
};

const validateInlineDerivedResponses = (
  definition: SpecDefinition,
  canonicalResponses: ReadonlyMap<string, ResponseDefinition>
): void => {
  for (const resource of Object.values(definition.resources)) {
    for (const operation of resource.operations) {
      for (const response of operation.responses) {
        if (isNamedResponseDefinition(response)) {
          continue;
        }

        validateDerivedResponseMetadata(response);
        validateDerivedResponseAgainstCanonicalGraph(
          response,
          canonicalResponses
        );
      }
    }
  }
};

export const normalizeResponseDefinition = (
  response: ResponseDefinition,
  location: Omit<NormalizedSpecWarningLocation, "part">
): NormalizeResponseDefinitionResult => {
  const body = normalizeBody({
    bodySchema: response.body,
    headerSchema: response.header,
    location: { ...location, part: "response.body" },
  });

  return {
    response: {
      name: response.name,
      statusCode: response.statusCode,
      statusCodeName: HttpStatusCodeNameMap[response.statusCode],
      description: response.description,
      header: response.header,
      body: body.body,
      kind: response.derived === undefined ? "response" : "derived-response",
      derivedFrom: response.derived?.parentName,
      lineage: response.derived?.lineage,
      depth: response.derived?.depth,
    },
    warnings: body.warnings,
  };
};

export const collectCanonicalResponses = (
  definition: SpecDefinition
): CollectCanonicalResponsesResult => {
  const canonicalResponseDefinitions =
    collectCanonicalResponseDefinitions(definition);
  const warnings: NormalizedSpecWarning[] = [];

  validateDerivedResponseGraph(canonicalResponseDefinitions);
  validateInlineDerivedResponses(definition, canonicalResponseDefinitions);

  const responses = new Map<string, NormalizedResponse>();

  for (const [responseName, response] of canonicalResponseDefinitions) {
    const normalized = normalizeResponseDefinition(response, {
      responseName,
      statusCode: response.statusCode,
    });

    responses.set(responseName, normalized.response);
    warnings.push(...normalized.warnings);
  }

  return { responses, warnings };
};
