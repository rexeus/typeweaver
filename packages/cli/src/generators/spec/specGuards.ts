import { HttpMethod } from "@rexeus/typeweaver-core";
import type { SpecDefinition } from "@rexeus/typeweaver-core";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isRequestDefinition = (value: unknown): boolean => {
  return isRecord(value);
};

const isResponseDefinition = (value: unknown): boolean => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.name === "string" &&
    value.name.length > 0 &&
    typeof value.description === "string" &&
    value.description.length > 0 &&
    typeof value.statusCode === "number"
  );
};

const isOperationDefinition = (value: unknown): boolean => {
  if (!isRecord(value) || !Array.isArray(value.responses)) {
    return false;
  }

  return (
    typeof value.operationId === "string" &&
    value.operationId.length > 0 &&
    typeof value.path === "string" &&
    value.path.length > 0 &&
    typeof value.summary === "string" &&
    value.summary.length > 0 &&
    Object.values(HttpMethod).includes(value.method as HttpMethod) &&
    isRequestDefinition(value.request) &&
    value.responses.length > 0 &&
    value.responses.every(response => isResponseDefinition(response))
  );
};

const isResourceDefinition = (value: unknown): boolean => {
  return (
    isRecord(value) &&
    Array.isArray(value.operations) &&
    value.operations.every(isOperationDefinition)
  );
};

export const isSpecDefinition = (value: unknown): value is SpecDefinition => {
  if (!isRecord(value) || !isRecord(value.resources)) {
    return false;
  }

  return Object.values(value.resources).every(isResourceDefinition);
};
