import { isCamelCase, isPascalCase } from "polycase";

const startsWithDigit = (value: string): boolean => /^[0-9]/u.test(value);

const isSupportedIdentifierName = (value: string): boolean => {
  if (startsWithDigit(value)) {
    return false;
  }

  return isCamelCase(value) || isPascalCase(value);
};

export const isSupportedOperationId = (value: string): boolean => {
  return isSupportedIdentifierName(value);
};

export const isSupportedResourceName = (value: string): boolean => {
  return isSupportedIdentifierName(value);
};
