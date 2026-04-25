import { isCamelCase, isPascalCase } from "polycase";

const isSupportedIdentifierName = (value: string): boolean => {
  return isCamelCase(value) || isPascalCase(value);
};

export const isSupportedOperationId = (value: string): boolean => {
  return isSupportedIdentifierName(value);
};

export const isSupportedResourceName = (value: string): boolean => {
  return isSupportedIdentifierName(value);
};
